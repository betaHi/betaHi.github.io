---
title: 从一行 D8 错误到构建系统修复：incremental desugar 与 Java nestmate 排查实录
date: 2026-07-21 00:00:00 +0800
categories: [Tech, Java]
tags: [java, nestmate, jvm, d8, android, desugar, build-system, jep-181]
---

这篇文章用一个真实的 Android 构建失败做例子，讲清楚如何从一行错误开始，一步一步定位到构建系统里的根因，并设计一个可验证的修复方案。

我们只保留最关键的一句错误日志：

```text
Caused by: com.android.tools.r8.utils.AbortException: Class MainActivity$2 requires its nest host MainActivity to be on program or class path.
```

这句话已经足够开始排查。它告诉我们三个线索：

1. 报错来自 `com.android.tools.r8`，也就是 Android 的 R8/D8 工具链。
2. 出问题的 class 是 `MainActivity$2`。
3. D8 需要它的 `nest host`，也就是 `MainActivity`，但当前输入里没看到。

下面从这句话开始拆。

## 第一步：先读懂错误本身

`D8` 是 Android 的 dex 编译器。普通 Java 编译器 `javac` 生成的是 `.class` 文件，但 Android Runtime 运行的是 `.dex` 文件。D8 的工作就是把 `.class` 或 `.jar` 转成 `.dex`。

举个例子：

```text
MainActivity.java
  -> javac
  -> MainActivity.class
  -> D8
  -> classes.dex
```

`MainActivity$2` 是 Java 编译后的内部类名字。在这个例子里，`sample-app/src/main/java/com/example/customlog/MainActivity.java` 里有一个 `CustomLogServiceConnection` 匿名内部类，它是 `MainActivity` 里的第二个匿名内部类，所以 javac 生成的 class 名字就是 `MainActivity$2.class`。

简化后的源码是这样：

```java
package com.example.customlog;

class MainActivity extends Activity {
  private CustomLogClient customLogClient;

  private final CustomLogServiceConnection customLogConnection =
      new CustomLogServiceConnection() {
        @Override
        public void onCustomLogServiceConnected(
            ComponentName name, CustomLogClient client) {
          customLogClient = client;
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
          customLogClient = null;
        }
      };
}
```

编译后对应的 class 路径是：

```text
com/example/customlog/MainActivity.class
com/example/customlog/MainActivity$2.class
```

`nest host` 是 Java 11 classfile 里的概念。为了把这句话讲清楚，需要同时解释 `nest`、`nest group`、`nestmate`、`NestHost` 和 `NestMembers`。

`nest` / `nest group` 指一组逻辑上属于同一个外部类的 class。`nest host` 是这组 class 的宿主，通常就是外部类；`nest member` 是这组里的成员，通常是内部类、匿名内部类、局部类。属于同一个 nest group 的这些 class 互相叫 `nestmates`。

在 classfile 里，这个关系由两个属性表达：

1. `NestHost` 写在 member class 上，表示“我的 host 是谁”。
2. `NestMembers` 写在 host class 上，表示“我的 group 里有哪些 members”。

举个例子：

```text
MainActivity.class          // nest host
MainActivity$1.class        // nest member
MainActivity$2.class        // nest member
MainActivity$LaunchInfo.class
```

对应到 classfile metadata，就是：

```text
MainActivity$2.class
  NestHost: MainActivity

MainActivity.class
  NestMembers: MainActivity$1, MainActivity$2, MainActivity$LaunchInfo, ...
```

这些 class 组成同一个 nest group，所以 `MainActivity.class`、`MainActivity$1.class`、`MainActivity$2.class` 互相都是 nestmates。

当 `MainActivity$2.class` 声明自己的 nest host 是 `MainActivity` 时，D8 在处理它时需要能看到 `MainActivity.class`。如果只给 D8 一个孤立的 `MainActivity$2.class`，D8 就不知道它所属的 nest 是否完整，也无法安全处理 nest-based access desugaring。

`program or class path` 也要拆开看。

`program path` 是 D8 本轮真正要编译成 dex 的输入。

`class path` 是 D8 只用来查类型、查方法、辅助分析的依赖输入。

举个例子：

```text
program input:
  tmp_extract_dir/com/example/customlog/MainActivity$2.class

classpath:
  android.jar
  custom_log_runtime/classes.jar
  other dependency jars
```

D8 的意思是：我至少要在本轮 program input 或 classpath 里看到 `MainActivity.class`，但现在没看到。

所以第一步可以得到一个初步判断：

```text
这不是 Java 语法错误，也不是 MainActivity$2.class 文件不存在。
更像是 D8 本轮拿到的输入集合不完整。
```

## 第二步：定位这是哪个模块和构建任务

看到 `MainActivity` 不要马上把它当成当前打开的 Activity。Android 工程里经常有多个 module、多个 sample、多个 test app 都叫 `MainActivity`。要先按完整包名找源头。

错误里的 class 实际是：

```text
com/example/customlog/MainActivity$2.class
```

对应源码是：

```text
sample-app/src/main/java/com/example/customlog/MainActivity.java
```

也就是说，它属于 `sample-app` 这个 Android module，而不是工程里其他同名 Activity。

在标准 Android/Gradle 工程里，可以先构建对应 module：

```bash
./gradlew :sample-app:assembleDebug --info
```

如果日志里能看到更细的 dex 任务，也可以单独关注失败的 dex/final dex 阶段。不同 Android Gradle Plugin 版本任务名会不同，常见名字包括：

```text
:sample-app:dexBuilderDebug
:sample-app:mergeDexDebug
:sample-app:mergeExtDexDebug
```

`final dex` 表示 APK 级别的最终 dex 阶段。一个 APK 会依赖很多 Java library、第三方依赖 jar 和生成代码，final dex 要把 APK 最终需要的 Java 字节码整合成 dex 输出。

它和普通 Java 编译不是一层。

例如：

```text
MainActivity.java
  -> javac 生成 .class
  -> 打成 app_classes.jar 或放入 javac/classes 输出目录
  -> D8 生成中间 dex
  -> final dex 整合 APK 所有 dex/class 输入
  -> APK
```

所以第二步要确认：失败发生在 dex/final dex 阶段，不是 javac，也不是资源编译。

## 第三步：判断为什么是 final dex 失败

如果只是普通的 Java 编译失败，错误通常会出现在 javac 阶段，比如找不到符号、类型不匹配、语法错误。

但这次错误来自 D8，而且提到了 `nest host` 和 `program or class path`，说明 Java 源码已经编译成 class 了，失败发生在 class 转 dex 或 desugar 过程中。

`desugar` 是把较新的 Java 语言特性或 classfile 特性改写成旧 Android Runtime 可以理解的形式。

直接用上面的 CustomLog 例子。`MainActivity$2.class` 对应 `CustomLogServiceConnection` 这个匿名内部类，它会写入外部类 `MainActivity` 的 private 字段 `customLogClient`：

```java
class MainActivity {
  private CustomLogClient customLogClient;

  private final CustomLogServiceConnection customLogConnection =
      new CustomLogServiceConnection() {
        @Override
        public void onCustomLogServiceConnected(
            ComponentName name, CustomLogClient client) {
          customLogClient = client;
        }
      };
}
```

javac 生成：

```text
MainActivity.class
MainActivity$2.class
```

在较新的 Java classfile 语义里，`MainActivity$2.class` 通过 nestmate 关系写入 `MainActivity.customLogClient`。旧 Android Runtime 不理解这种访问方式，所以 D8 会做 desugar，把它改写成旧 runtime 能理解的访问形式：

```text
desugar 前:
  MainActivity$2.onCustomLogServiceConnected()
    通过 nestmate 语义写入 MainActivity.customLogClient

desugar 后:
  MainActivity$2.onCustomLogServiceConnected()
    调用 D8 生成的辅助访问方法，再写入 customLogClient
```

本问题里相关的是 `nest-based access desugaring`。Java nestmate 允许同一个 nest 里的类更自然地访问彼此的 private 成员，但老 Android runtime 不理解这种 classfile 语义，所以 D8 需要把它改写成可运行的形式。

final dex 有两类常见路径。

第一类是 `dex merge`，也就是合并已经生成好的 dex 文件。

举例：

```text
library_a.dex
library_b.dex
library_c.dex
  -> merge
  -> final classes.dex
```

第二类是 `re-desugar`，也就是 final dex 阶段重新拿 `.class` 输入做 desugar 和 dex。

举例：

```text
processed_classpath 中的一堆 .jar/.class
  -> D8 --desugar
  -> final dex
```

本次失败走的是第二类。典型参数长这样：

```text
--class-inputs-filearg=@FileArg(...:processed_classpath)
--desugar
--desugar-dependencies ...app_final_dex.desugardeps
```

这里的 `--class-inputs-filearg` 表示 D8 这次吃的是 class 输入，不是现成 dex。

`--desugar-dependencies` 引出了下一个关键文件：`.desugardeps`。

## 第四步：理解 `.desugardeps` 如何把依赖变化连到 `MainActivity$2`

`.desugardeps` 是构建系统里的 D8 wrapper 写出来的 desugar 依赖文件。它记录某个 class 在 desugar 时依赖了哪些其他 class。

格式像这样：

```text
A.class
  <-  B.class
```

意思是：

```text
如果 B.class 变化了，A.class 需要被重新评估并重新 desugar。
```

这次关键链路类似：

```text
com/example/customlog/MainActivity$2.class
  <-  com/example/customlog/runtime/CustomLogServiceConnection.class
  <-  com/example/customlog/MainActivity.class
```

`CustomLogServiceConnection.class` 不是 app 源码目录里直接展开的 `.class` 文件，而是在生成出来的依赖 jar 里。

举例查找方式：

```bash
zipinfo -1 \
  app/build/intermediates/transforms/custom_log_runtime/classes.jar \
  | rg 'com/example/customlog/runtime/CustomLogServiceConnection.class'
```

如果一次 CustomLog 依赖更新导致这个 jar entry 变化，incremental D8 就会查 `.desugardeps`，发现 `MainActivity$2.class` 受影响，于是决定重新处理它。

`incremental D8` 是增量 D8。为了加快构建，它不会每次都把所有 class 全部重新 dex，而是根据上一次构建记录，只处理变化的 class 和受影响的 class。

举个例子：

```text
全量 D8:
  处理 10000 个 class

增量 D8:
  发现只有 B.class 变化
  查依赖后只处理 A.class 和 B.class
```

增量构建本身没问题。问题在于，这次被选中的 `A.class` 是 `MainActivity$2.class`，它不是独立 class，而是 nest group 的一员。

## 第五步：发现真正的问题是“只抽了一个 member”

incremental D8 不是直接把整个 app 的 Java class 输出都交给 D8。它会先从 jar 或 classes 目录里抽取需要重新处理的 class 到临时目录。

错误里的路径已经暴露了这一点：

```text
tmp_extract_dir/com/example/customlog/MainActivity$2.class
```

这说明构建脚本先抽出了 `MainActivity$2.class`，然后把它交给 D8。

问题是，原始 jar 里其实有完整的一组 class：

```text
com/example/customlog/MainActivity.class
com/example/customlog/MainActivity$1.class
com/example/customlog/MainActivity$2.class
com/example/customlog/MainActivity$3.class
com/example/customlog/MainActivity$4.class
com/example/customlog/MainActivity$5.class
com/example/customlog/MainActivity$LaunchInfo.class
com/example/customlog/MainActivity$PinInfo.class
```

但增量抽取时只拿了其中一个：

```text
com/example/customlog/MainActivity$2.class
```

于是 D8 看到的世界变成：

```text
我有 MainActivity$2.class。
它说自己的 nest host 是 MainActivity。
但是我看不到 MainActivity.class。
所以我不能继续。
```

这就是错误日志的真实含义。

## 第六步：用 `javap` 确认 `NestHost`

现在要验证一件事：`MainActivity$2.class` 声明了自己的 nest host 是 `MainActivity`。

要证明它，可以用 `javap -v`。

`javap` 是 JDK 自带的 class 文件查看工具。`-v` 表示输出详细 classfile metadata。

示例命令：

```bash
third_party/jdk/current/bin/javap \
  -classpath app/build/intermediates/javac/debug/classes.jar \
  -v 'com.example.customlog.MainActivity$2' \
  | rg -n 'NestHost|InnerClasses|EnclosingMethod|com/example/customlog/MainActivity' -A4 -B2
```

关键输出应该包含：

```text
NestHost: class com/example/customlog/MainActivity
```

这一步很重要，因为它把排查从猜测变成证据：

```text
MainActivity$2.class 不是普通孤立 class。
它的 classfile metadata 明确要求 MainActivity 作为 nest host。
```

再举一个简单例子：

```java
class Outer {
  private int value;

  Runnable create() {
    return new Runnable() {
      @Override
      public void run() {
        System.out.println(value);
      }
    };
  }
}
```

javac 生成：

```text
Outer.class
Outer$1.class
```

`Outer$1.class` 访问了 `Outer` 的 private 字段 `value`。在 Java nestmate 语义下，它们属于同一个 nest，D8 处理 `Outer$1.class` 时就需要知道 `Outer.class` 的存在。

## 第七步：解释为什么本地复现不稳定

这个问题不是稳定的 clean build 错误。它依赖增量状态。

clean build 时，构建系统通常会全量抽取所有 class：

```text
MainActivity.class
MainActivity$1.class
MainActivity$2.class
...
```

这样 D8 能看到完整 nest group，自然不会报错。

no-op build 时，target 已经 up-to-date，D8 根本不会重新跑。

真正容易复现的是 CI builder 这种状态：

```text
1. builder 已经有上一次成功构建留下的输出。
2. builder 有旧的 `.desugardeps` 和 `.md5.stamp`。
3. 某次依赖更新改动了 CustomLog runtime jar。
4. md5/subpath tracking 发现 CustomLog 某个 class entry 变化。
5. incremental D8 只抽受影响 class。
6. 受影响 class 刚好是 Java nest member。
```

`.md5.stamp` 是构建系统记录上一次输入状态的文件。它可以帮助判断某个输入文件或 jar entry 是否变化。

举个例子：

```text
上次:
  custom_log_runtime/classes.jar 中 CustomLogServiceConnection.class 的 checksum = abc

这次:
  checksum = def

结论:
  这个 jar entry 变化了。
```

如果没有旧 stamp 或旧 `.desugardeps`，本地直接跑会走全量路径，也就不复现。

## 第八步：设计复现

复现可以分三层，从简单到接近 CI。

### 复现 A：直接跑目标

```bash
./gradlew :sample-app:assembleDebug --info
```

这个方法最简单，但不稳定。它取决于你的输出目录是否刚好处在问题状态。

### 复现 B：做一个 D8 微复现

目标是证明“只给 D8 一个 nest member 会失败”。

步骤：

```text
1. 从 javac jar 里只抽 MainActivity$2.class。
2. 用 D8 或构建系统里的 D8 wrapper 跑 desugar。
3. 观察它报同样的 nest host 错误。
4. 再抽完整 MainActivity*.class group。
5. 重新跑 D8，观察通过。
```

示例：

```bash
mkdir -p /tmp/d8_repro/only_member
cd /tmp/d8_repro/only_member
jar xf /path/to/project/app/build/intermediates/javac/debug/classes.jar \
  'com/example/customlog/MainActivity$2.class'
```

如果这时只把这个目录作为 D8 program input，并启用 desugar，就会得到类似错误：

```text
Class MainActivity$2 requires its nest host MainActivity to be on program or class path.
```

再抽完整组：

```bash
mkdir -p /tmp/d8_repro/full_group
cd /tmp/d8_repro/full_group
jar xf /path/to/project/app/build/intermediates/javac/debug/classes.jar \
  com/example/customlog/MainActivity.class \
  'com/example/customlog/MainActivity$1.class' \
  'com/example/customlog/MainActivity$2.class' \
  'com/example/customlog/MainActivity$3.class' \
  'com/example/customlog/MainActivity$4.class' \
  'com/example/customlog/MainActivity$5.class'
```

这时 D8 能继续处理。这个微复现证明：问题不是 D8 不能处理 `MainActivity$2`，而是不能处理孤立的 `MainActivity$2`。

### 复现 C：模拟 CI 的依赖变化

更接近 CI 的方式是临时修改 generated dependency jar 里的 `CustomLogServiceConnection.class`，让 incremental D8 认为 classpath 变了。

思路：

```text
1. 保留已有 final dex 输出、`.md5.stamp` 和 `.desugardeps`。
2. 修改 build/.../custom_log_runtime/classes.jar 里的 CustomLogServiceConnection.class。
3. 重新跑对应 app module 的 assemble 或 dex task。
4. 观察 D8 是否只抽 MainActivity$2.class 并报错。
```

这个复现方式要注意：修改的是 build output，只能本地临时使用，复现后要恢复，不能提交。

## 第九步：排除几个看起来合理但不根治的修法

### 修法一：改 `MainActivity.java`

例如把匿名内部类改成具名类，避免生成 `MainActivity$2.class`。

这可以绕开当前错误，但不是根治。

原因是：

```text
任何 Java nest member 都会在同样的增量抽取缺陷下触发同类问题。
当前只是 MainActivity$2 被 CustomLog 依赖变化牵出来。
换一个 target、换一个内部类，问题仍然存在。
```

### 修法二：只把 `MainActivity.class` 加进来

这比只抽 `MainActivity$2.class` 好，但仍然不够。

D8 的 nest-based access desugaring 需要看到同一个 nest group 的多个 members。

举例：

```text
MainActivity.class
MainActivity$1.class
MainActivity$2.class
MainActivity$3.class
```

如果只给：

```text
MainActivity.class
MainActivity$2.class
```

仍会缺少其他 nest member 信息。

### 修法三：对 `.desugardeps` 求传递闭包

传递闭包的意思是：从一个 class 出发，把依赖图里能递归走到的 class 都加入。

举例：

```text
A <- B
B <- C
C <- D
```

如果 B 变了，不只拉 A，还继续拉 C、D 或相关节点。

这个办法理论上能拉进更多 class，但风险是范围变得很大，甚至接近全量 dex，影响 incremental D8 的性能。更重要的是，`.desugardeps` 是 desugar 依赖图，不是 Java nest group 的语义模型。用它做大范围闭包，有点绕远。

## 第十步：根修应该修哪里

根因在构建脚本的 incremental class extraction。

也就是：当它决定抽取 `MainActivity$2.class` 时，应该意识到这是 `MainActivity` 这个 nest group 的一员，于是把同组 class 一起抽出来。

可以利用 javac 的命名约定：

```text
Outer.class
Outer$1.class
Outer$Inner.class
Outer$Inner$Deep.class
```

这些都共享同一个 prefix：

```text
Outer
```

带 package 时也是一样：

```text
pkg/Outer.class          -> pkg/Outer
pkg/Outer$1.class        -> pkg/Outer
pkg/Outer$Inner.class    -> pkg/Outer
```

所以修复思路是：

```text
1. 先根据 changed/required class 计算 nest prefix。
2. 遍历 jar entry 时，凡是同 prefix 的 .class 都抽出来。
3. 这样 D8 看到的就是完整或足够完整的 nest group。
```

推荐代码形态类似：

```python
def _ClassFileNestPrefix(class_path):
  base = class_path[:-len('.class')]
  slash = base.rfind('/')
  dollar = base.find('$', slash + 1)
  if dollar != -1:
    base = base[:dollar]
  return base
```

这个 helper 的例子：

```text
_ClassFileNestPrefix('pkg/Top.class')             -> 'pkg/Top'
_ClassFileNestPrefix('pkg/Outer$Inner.class')     -> 'pkg/Outer'
_ClassFileNestPrefix('pkg/Outer$Inner$Deep.class')-> 'pkg/Outer'
_ClassFileNestPrefix('Outer$1.class')             -> 'Outer'
_ClassFileNestPrefix('weird$pkg/Top.class')       -> 'weird$pkg/Top'
```

注意最后一个例子。`$` 如果出现在 package path 里，不应该被当成内部类分隔符。只看最后一个 `/` 后面的 simple class name。

然后在抽取逻辑里做扩展：

```python
changed_class_set = (set(changes.IterChangedSubpaths(jar))
                     | required_classes_set)

nest_prefixes = {
    _ClassFileNestPrefix(path)
    for path in changed_class_set
    if _IsClassFile(path)
}

predicate = lambda path: _IsClassFile(path) and (
    _ClassFileNestPrefix(path) in nest_prefixes)
```

举个完整例子：

```text
changed_class_set:
  pkg/Outer$1.class

nest_prefixes:
  pkg/Outer

jar entries:
  pkg/Outer.class       -> 抽出
  pkg/Outer$1.class     -> 抽出
  pkg/Outer$2.class     -> 抽出
  pkg/Other.class       -> 跳过
  pkg/Outer.txt         -> 跳过
```

这样修复的是根因：D8 的输入集合不再只包含一个孤立 nest member。

## 第十一步：给修复加测试

测试不要只测 helper，最好测真实抽取行为。

第一类测试：prefix 计算。

```python
def testClassFileNestPrefix(self):
  cases = {
      'pkg/Top.class': 'pkg/Top',
      'pkg/Outer$Inner.class': 'pkg/Outer',
      'pkg/Outer$Inner$Deep.class': 'pkg/Outer',
      'Outer$1.class': 'Outer',
      'weird$pkg/Top.class': 'weird$pkg/Top',
  }
  for path, expected in cases.items():
    self.assertEqual(dex._ClassFileNestPrefix(path), expected, msg=path)
```

第二类测试：抽取行为。

构造一个临时 jar：

```text
pkg/Outer.class
pkg/Outer$1.class
pkg/Outer$2.class
pkg/Other.class
pkg/Outer.txt
```

模拟 `required_classes_set` 只有：

```text
pkg/Outer$1.class
```

期望抽出来的是：

```text
pkg/Outer.class
pkg/Outer$1.class
pkg/Outer$2.class
```

不应该抽：

```text
pkg/Other.class
pkg/Outer.txt
```

这个测试直接证明修复覆盖了真实问题：只要一个 nest member 被要求重 dex，同组 nestmates 会一起进入 D8 输入。

## 第十二步：验证修复

先跑 Python 语法检查：

```bash
python3 -m py_compile build/android/gyp/dex.py build/android/gyp/dex_test.py
```

再跑单元测试：

```bash
python3 build/android/gyp/dex_test.py
```

预期类似：

```text
Ran 3 tests in 0.012s

OK
```

最后做接近 CI 的验证：模拟 generated dependency jar 变化，然后跑 final dex：

```bash
./gradlew :sample-app:assembleDebug --info
```

如果修复正确，即使仍然走：

```text
--class-inputs-filearg
--desugar
--desugar-dependencies
```

也应该通过。

验证时要特别注意一点：不要只证明“通过了”，还要证明“是在原来的 re-desugar 路径上通过了”。如果只是把 minSdk 调高让它走 dex merge，那是绕过，不是证明 root fix。

## 最终链路图

把前面的排查压成一条完整链路，就是：

```text
CustomLogServiceConnection.class 变化
  -> `.desugardeps` 记录 MainActivity$2.class 依赖它
  -> incremental D8 判定 MainActivity$2.class 需要重新 desugar
  -> 构建脚本只从 jar 里抽出 MainActivity$2.class
  -> MainActivity$2.class 的 classfile metadata 声明 NestHost = MainActivity
  -> D8 本轮输入里没有 MainActivity.class 和同组 nestmates
  -> D8 无法完成 nest-based access desugaring
  -> 报 requires its nest host
```

所以这篇文章要解决的不是 D8 完全不能处理 nestmate，而是构建系统在 incremental extraction 阶段给 D8 的输入不完整。只要把同一个 nest group 的 class 一起抽出来，D8 就能继续处理。

## 读完你应该能回答的问题

读完这篇文章，应该能回答下面几个问题：

1. 为什么 `MainActivity$2.class` 不能被孤立地交给 D8？
2. `NestHost`、`NestMembers`、`nest group`、`nestmates` 分别表示什么关系？
3. `.desugardeps` 在这次问题里起什么作用？
4. 为什么 clean build 不稳定复现，而 CI 的增量构建状态更容易复现？
5. 为什么改 `MainActivity.java` 或调高 minSdk 都只是绕过，不是根修？
6. 为什么按 javac 的 `Outer$Member.class` 命名规则补齐同组 class 是更合适的修复？

## 官方参考资料

这些链接可以作为文中概念的官方出处：

1. Java VM Spec: [The `NestHost` Attribute](https://docs.oracle.com/javase/specs/jvms/se11/html/jvms-4.html#jvms-4.7.28)
2. Java VM Spec: [The `NestMembers` Attribute](https://docs.oracle.com/javase/specs/jvms/se11/html/jvms-4.html#jvms-4.7.29)
3. OpenJDK JEP 181: [Nest-Based Access Control](https://openjdk.org/jeps/181)
4. Android Developers: [D8 dexer](https://developer.android.com/tools/d8)
5. Android Developers: [Java 8+ API desugaring support](https://developer.android.com/studio/write/java8-support)
6. Oracle JDK Tools: [`javap` command](https://docs.oracle.com/en/java/javase/17/docs/specs/man/javap.html)

## 结论

这次问题可以用一条链路总结：

```text
CustomLog classpath jar 变化
  -> `.desugardeps` 找到受影响的 MainActivity$2.class
  -> incremental D8 只抽出 MainActivity$2.class
  -> MainActivity$2.class 声明 NestHost = MainActivity
  -> D8 看不到 MainActivity.class 和同组 nestmates
  -> nest-based access desugaring 报错
```

最好的修复不是改 `MainActivity.java`，也不是单纯清理 CI 输出，而是在 incremental D8 的 class extraction 阶段补齐 Java nest group。

文章开头那一行错误，其实已经给了方向：

```text
requires its nest host
```

看到这几个词，就应该想到：

```text
不是某个 class 不存在这么简单，
而是一个 Java nest member 被孤立地交给了 D8。
```

排查这类问题的关键，是从 D8 报错反推输入集合，再从输入集合反推增量抽取逻辑，最后把修复放在构建系统保证输入完整性的地方。

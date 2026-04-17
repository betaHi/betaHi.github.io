function normalizeMermaidBlocks() {
  const codeBlocks = document.querySelectorAll('pre > code.language-mermaid');

  codeBlocks.forEach((codeBlock, index) => {
    const pre = codeBlock.parentElement;

    if (!pre || pre.dataset.mermaidProcessed === 'true') {
      return;
    }

    const container = document.createElement('div');
    container.className = 'mermaid';
    container.id = `mermaid-diagram-${index}`;
    container.textContent = codeBlock.textContent.trim();

    pre.replaceWith(container);
  });
}

function normalizeRenderedMermaidDiagrams() {
  const diagrams = document.querySelectorAll('.mermaid');

  diagrams.forEach((diagram) => {
    const svg = diagram.querySelector('svg');

    if (!svg) {
      return;
    }

    diagram.style.overflowX = 'auto';
    diagram.style.overflowY = 'visible';

    svg.style.display = 'block';
    svg.style.maxWidth = '100%';
    svg.style.height = 'auto';
    svg.style.overflow = 'visible';
    svg.removeAttribute('width');
    svg.removeAttribute('height');
  });
}

async function initMermaid() {
  const mermaid = window.claudeCodeArchitectureMermaid;

  if (!mermaid) {
    return;
  }

  normalizeMermaidBlocks();

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose'
  });

  await mermaid.run({
    querySelector: '.mermaid'
  });

  normalizeRenderedMermaidDiagrams();
}

const run = () => {
  initMermaid().catch((error) => {
    console.error('Failed to initialize Mermaid diagrams.', error);
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', run, { once: true });
} else {
  run();
}

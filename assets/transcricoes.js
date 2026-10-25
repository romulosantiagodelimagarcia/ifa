window.IFA_TRANSCRIPT_READY = fetch('assets/transcricoes.json.gz')
  .then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!window.DecompressionStream) throw new Error('Este navegador não descompacta dados gzip.');
    return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
  });

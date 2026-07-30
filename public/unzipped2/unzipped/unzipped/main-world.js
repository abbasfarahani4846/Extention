// Runs in MAIN world to extract YouTube variables
(function() {
  let capturedUrl = null;
  let waitCallbacks = [];

  function intercept(url) {
    if (url && typeof url === 'string' && url.includes('/api/timedtext')) {
      capturedUrl = url;
      waitCallbacks.forEach(cb => cb(url));
      waitCallbacks = [];
    }
  }

  const origFetch = window.fetch;
  window.fetch = function(req, init) {
    try {
      const url = typeof req === 'string' ? req : (req && req.url);
      intercept(url);
    } catch(e) {}
    return origFetch.apply(this, arguments);
  };

  const origXHR = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    try { intercept(url); } catch(e) {}
    return origXHR.apply(this, arguments);
  };

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.data.action !== 'REQUEST_YT_RESPONSE') return;
    
    try {
      const player = document.getElementById("movie_player");
      if (!player) return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'NO_PLAYER' }, '*');
      
      const ytResponse = typeof player.getPlayerResponse === 'function' ? player.getPlayerResponse() : window.ytInitialPlayerResponse;
      if (!ytResponse || !ytResponse.captions) {
        return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'NO_CAPTIONS' }, '*');
      }

      // Ensure captions module is loaded
      try { if (typeof player.loadModule === 'function') player.loadModule("captions"); } catch(e) {}
      await new Promise(r => setTimeout(r, 400));
      
      let tracks = [];
      try { tracks = player.getOption("captions", "tracklist") || []; } catch(e) {}
      
      if (!tracks.length) {
        tracks = ytResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      }
      
      if (!tracks.length) {
        return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'NO_TRACKS' }, '*');
      }

      function preferredIndex(tList) {
        const manualEnglish = tList.find(t => t.kind !== "asr" && (t.languageCode || "").startsWith("en"));
        const anyEnglish = tList.find(t => (t.languageCode || "").startsWith("en"));
        const manualAny = tList.find(t => t.kind !== "asr");
        const selected = manualEnglish || anyEnglish || manualAny || tList[0];
        const idx = tList.indexOf(selected);
        return idx > -1 ? idx : 0;
      }
      const selectedTrack = tracks[preferredIndex(tracks)];

      capturedUrl = null;
      
      // Force player to fetch the best available track
      try { player.setOption("captions", "track", {}); } catch(e) {}
      await new Promise(r => setTimeout(r, 100));
      
      try {
        const normTrack = {
          languageCode: selectedTrack.languageCode || selectedTrack.lang || "",
          kind: selectedTrack.kind || (selectedTrack.vssId && selectedTrack.vssId.includes('a.') ? 'asr' : 'manual'),
          vssId: selectedTrack.vssId || ""
        };
        player.setOption("captions", "track", normTrack);
      } catch(e) {}

      // Wait for intercepted URL
      let finalUrl = capturedUrl;
      if (!finalUrl) {
        finalUrl = await new Promise(resolve => {
          waitCallbacks.push(resolve);
          setTimeout(() => {
            const idx = waitCallbacks.indexOf(resolve);
            if (idx > -1) waitCallbacks.splice(idx, 1);
            resolve(capturedUrl);
          }, 3000);
        });
      }
      
      // Reset player track
      try { player.setOption("captions", "track", {}); } catch(e) {}

      if (!finalUrl) {
        // Fallback to baseUrl
        finalUrl = selectedTrack.baseUrl;
      }
      
      if (!finalUrl) {
         return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'CAPTURE_FAILED' }, '*');
      }

      const urlObj = new URL(finalUrl, location.origin);
      urlObj.searchParams.set('fmt', 'json3');
      
      const res = await origFetch(urlObj.toString());
      if (!res.ok) return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'HTTP_ERROR' }, '*');
      
      const text = await res.text();
      if (!text) return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'EMPTY_BODY' }, '*');
      
      const json = JSON.parse(text);
      if (!json.events) return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'NO_EVENTS' }, '*');
      
      window.postMessage({
        action: 'RESPONSE_YT_RESPONSE',
        success: true,
        events: JSON.parse(JSON.stringify(json.events))
      }, '*');
      
    } catch(e) {
      window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'EXCEPTION', details: e.message }, '*');
    }
  });
})();
console.log('AI Companion Main World Script Injected');

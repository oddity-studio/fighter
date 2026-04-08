        var wfCanvas = document.getElementById('waveform-canvas');
        var wfCtx = wfCanvas.getContext('2d');
        var zmCanvas = document.getElementById('waveform-zoom');
        var zmCtx = zmCanvas.getContext('2d');
        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        window.sharedAudioCtx = audioCtx;

        function resizeWf() {
          wfCanvas.width = wfCanvas.offsetWidth * (window.devicePixelRatio || 1);
          wfCanvas.height = wfCanvas.offsetHeight * (window.devicePixelRatio || 1);
          zmCanvas.width = zmCanvas.offsetWidth * (window.devicePixelRatio || 1);
          zmCanvas.height = zmCanvas.offsetHeight * (window.devicePixelRatio || 1);
        }
        resizeWf();
        window.addEventListener('resize', function() { resizeWf(); drawWaveform(wfData); });

        var wfData = null;
        var wfDuration = 0;
        var windowPos = 0;

        function roundRect(ctx, x, y, w, h, r) {
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.arcTo(x + w, y, x + w, y + r, r);
          ctx.lineTo(x + w, y + h - r);
          ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
          ctx.lineTo(x + r, y + h);
          ctx.arcTo(x, y + h, x, y + h - r, r);
          ctx.lineTo(x, y + r);
          ctx.arcTo(x, y, x + r, y, r);
          ctx.closePath();
        }
        window.roundRect = roundRect;

        function drawWaveform(data) {
          if (!data || !wfDuration) return;
          var w = wfCanvas.width;
          var h = wfCanvas.height;
          var dpr = window.devicePixelRatio || 1;
          wfCtx.clearRect(0, 0, w, h);

          var len = data.length;
          var barW = 4 * dpr;
          var gap = 4 * dpr;
          var totalBars = Math.floor(w / (barW + gap));
          var step = Math.ceil(len / totalBars);
          var mid = h / 2;
          var barRadius = barW / 2;

          for (var i = 0; i < totalBars; i++) {
            var x = i * (barW + gap);
            var start = i * step;
            var end = Math.min(start + step, len);
            var sum = 0;
            for (var j = start; j < end; j++) {
              sum += data[j] * data[j];
            }
            var rms = Math.sqrt(sum / (end - start));
            var barH = Math.max(2 * dpr, Math.pow(rms, 0.5) * mid * 0.9);
            var y = mid - barH / 2;

            var grad = wfCtx.createLinearGradient(0, y, 0, y + barH);
            grad.addColorStop(0, '#00e5ff');
            grad.addColorStop(1, '#007aad');
            wfCtx.fillStyle = grad;
            wfCtx.beginPath();
            wfCtx.moveTo(x + barRadius, y);
            wfCtx.lineTo(x + barW - barRadius, y);
            wfCtx.arcTo(x + barW, y, x + barW, y + barRadius, barRadius);
            wfCtx.lineTo(x + barW, y + barH - barRadius);
            wfCtx.arcTo(x + barW, y + barH, x + barW - barRadius, y + barH, barRadius);
            wfCtx.lineTo(x + barRadius, y + barH);
            wfCtx.arcTo(x, y + barH, x, y + barH - barRadius, barRadius);
            wfCtx.lineTo(x, y + barRadius);
            wfCtx.arcTo(x, y, x + barRadius, y, barRadius);
            wfCtx.closePath();
            wfCtx.fill();
          }

          if (wfDuration > 0) {
            var windowW = (30 / wfDuration) * w;
            var windowX = windowPos * (w - windowW);
            var radius = 10 * dpr;

            wfCtx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            roundRect(wfCtx, windowX, 0, windowW, h, radius);
            wfCtx.fill();

            wfCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            wfCtx.lineWidth = 2 * dpr;
            roundRect(wfCtx, windowX, 0, windowW, h, radius);
            wfCtx.stroke();
          }

          drawZoom(data);
        }

        function drawZoom(data) {
          if (!data || wfDuration === 0) return;
          var zw = zmCanvas.width;
          var zh = zmCanvas.height;
          var dpr = window.devicePixelRatio || 1;
          zmCtx.clearRect(0, 0, zw, zh);

          var len = data.length;
          var startSample = Math.floor((windowPos * (wfDuration - 30)) / wfDuration * len);
          var endSample = Math.floor(((windowPos * (wfDuration - 30)) + 30) / wfDuration * len);
          var sampleRange = endSample - startSample;

          var totalBars = 30;
          var isPortrait = window.innerHeight > window.innerWidth;
          var gap = (isPortrait ? 2.5 : 5) * dpr;
          var barW = Math.max(2 * dpr, (zw - gap * (totalBars - 1)) / totalBars);
          var step = Math.ceil(sampleRange / totalBars);
          var mid = zh / 2;
          var barRadius = barW / 2;

          var barHeights = [];

          for (var i = 0; i < totalBars; i++) {
            var x = i * (barW + gap);
            var s = startSample + i * step;
            var e = Math.min(s + step, endSample, len);
            if (s >= len) break;
            var sum = 0;
            var count = 0;
            for (var j = s; j < e; j++) {
              sum += data[j] * data[j];
              count++;
            }
            var rms = count > 0 ? Math.sqrt(sum / count) : 0;
            var barH = Math.max(2 * dpr, Math.pow(rms, 0.7) * mid * 2.2);
            var y = mid - barH / 2;
            barHeights.push({ i: i, h: barH, x: x, y: y });

            var grad = zmCtx.createLinearGradient(0, y, 0, y + barH);
            if (i < 7) {
              grad.addColorStop(0, '#7a8f93');
              grad.addColorStop(1, '#6a7b80');
            } else {
              grad.addColorStop(0, '#00e5ff');
              grad.addColorStop(1, '#007aad');
            }
            zmCtx.fillStyle = grad;
            zmCtx.beginPath();
            zmCtx.moveTo(x + barRadius, y);
            zmCtx.lineTo(x + barW - barRadius, y);
            zmCtx.arcTo(x + barW, y, x + barW, y + barRadius, barRadius);
            zmCtx.lineTo(x + barW, y + barH - barRadius);
            zmCtx.arcTo(x + barW, y + barH, x + barW - barRadius, y + barH, barRadius);
            zmCtx.lineTo(x + barRadius, y + barH);
            zmCtx.arcTo(x, y + barH, x, y + barH - barRadius, barRadius);
            zmCtx.lineTo(x, y + barRadius);
            zmCtx.arcTo(x, y, x + barRadius, y, barRadius);
            zmCtx.closePath();
            zmCtx.fill();
          }

          var colored = barHeights.filter(function(b) { return b.i >= 7; });
          colored.sort(function(a, b) { return b.h - a.h; });
          var spikes = [];
          for (var si = 0; si < colored.length && spikes.length < 3; si++) {
            var candidate = colored[si];
            var tooClose = spikes.some(function(s) { return Math.abs(s.i - candidate.i) < 4; });
            if (!tooClose) spikes.push(candidate);
          }
          window.beat1Spikes = spikes.map(function(s) { return s.i; });
          zmCtx.shadowColor = '#00ffff';
          zmCtx.shadowBlur = 14 * dpr;
          spikes.forEach(function(sp) {
            var grad2 = zmCtx.createLinearGradient(0, sp.y, 0, sp.y + sp.h);
            grad2.addColorStop(0, '#80ffff');
            grad2.addColorStop(1, '#33d6ff');
            zmCtx.fillStyle = grad2;
            zmCtx.beginPath();
            zmCtx.moveTo(sp.x + barRadius, sp.y);
            zmCtx.lineTo(sp.x + barW - barRadius, sp.y);
            zmCtx.arcTo(sp.x + barW, sp.y, sp.x + barW, sp.y + barRadius, barRadius);
            zmCtx.lineTo(sp.x + barW, sp.y + sp.h - barRadius);
            zmCtx.arcTo(sp.x + barW, sp.y + sp.h, sp.x + barW - barRadius, sp.y + sp.h, barRadius);
            zmCtx.lineTo(sp.x + barRadius, sp.y + sp.h);
            zmCtx.arcTo(sp.x, sp.y + sp.h, sp.x, sp.y + sp.h - barRadius, barRadius);
            zmCtx.lineTo(sp.x, sp.y + barRadius);
            zmCtx.arcTo(sp.x, sp.y, sp.x + barRadius, sp.y, barRadius);
            zmCtx.closePath();
            zmCtx.fill();
          });
          zmCtx.shadowBlur = 0;

          if (window.beat1Placements) {
            var zWindowStart = windowPos * (wfDuration - 30);
            var zWindowEnd = zWindowStart + 30;
            var typeColors = { ATTACK: 'rgba(140, 50, 200, 0.6)', DEFENSE: 'rgba(120, 120, 120, 0.6)', SKILL: 'rgba(200, 170, 50, 0.6)' };
            var typeBorders = { ATTACK: 'rgba(180, 80, 240, 0.8)', DEFENSE: 'rgba(160, 160, 160, 0.8)', SKILL: 'rgba(230, 200, 60, 0.8)' };
            window.beat1Placements.forEach(function(p) {
              var px = ((p.tick - 1) / 30) * zw;
              var pw = (p.time / 30) * zw;
              var pr = 6 * dpr;
              var blockH = zh * 0.8;
              var blockY = (zh - blockH) / 2;
              zmCtx.fillStyle = typeColors[p.type];
              window.roundRect(zmCtx, px, blockY, pw, blockH, pr);
              zmCtx.fill();
              zmCtx.strokeStyle = typeBorders[p.type];
              zmCtx.lineWidth = 2 * dpr;
              window.roundRect(zmCtx, px, blockY, pw, blockH, pr);
              zmCtx.stroke();

              zmCtx.fillStyle = 'rgba(255,255,255,0.9)';
              zmCtx.font = '500 ' + (10 * dpr) + 'px "Exo 2", sans-serif';
              zmCtx.textAlign = 'center';
              zmCtx.textBaseline = 'middle';
              zmCtx.fillText(p.name, px + pw / 2, zh / 2);
            });
          }

          if (window.dragPreview && window.dragPreview.canvas === 'zoom') {
            var dp = window.dragPreview;
            var dpx = dp.bar * zw;
            var dpw = (dp.time / 30) * zw;
            var dpr2 = 6 * dpr;
            var dpH = zh * 0.8;
            var dpY = (zh - dpH) / 2;
            if (dp.overlap) {
              zmCtx.fillStyle = 'rgba(220, 40, 40, 0.35)';
              zmCtx.strokeStyle = 'rgba(255, 80, 80, 0.7)';
            } else {
              var colors = { ATTACK: 'rgba(140, 50, 200, 0.35)', DEFENSE: 'rgba(120, 120, 120, 0.35)', SKILL: 'rgba(200, 170, 50, 0.35)' };
              zmCtx.fillStyle = colors[dp.type];
              zmCtx.strokeStyle = 'rgba(255,255,255,0.5)';
            }
            window.roundRect(zmCtx, dpx, dpY, dpw, dpH, dpr2);
            zmCtx.fill();
            zmCtx.setLineDash([4 * dpr, 4 * dpr]);
            zmCtx.lineWidth = 2 * dpr;
            window.roundRect(zmCtx, dpx, dpY, dpw, dpH, dpr2);
            zmCtx.stroke();
            zmCtx.setLineDash([]);
          }
        }

        fetch('resources/Beat1.mp3')
          .then(function(r) { return r.arrayBuffer(); })
          .then(function(buf) { return audioCtx.decodeAudioData(buf); })
          .then(function(audioBuffer) {
            wfData = audioBuffer.getChannelData(0);
            wfDuration = audioBuffer.duration;
            window.beat1Buffer = audioBuffer;
            drawWaveform(wfData);
          });

        var dragging = false;

        function getCanvasX(e) {
          var rect = wfCanvas.getBoundingClientRect();
          var clientX = e.touches ? e.touches[0].clientX : e.clientX;
          return (clientX - rect.left) / rect.width;
        }

        wfCanvas.style.cursor = 'pointer';
        var snippetLocked = false;

        wfCanvas.addEventListener('mousedown', function(e) {
          if (snippetLocked) return;
          dragging = true;
          windowPos = Math.max(0, Math.min(1, getCanvasX(e)));
          drawWaveform(wfData);
          updateDragGhostTime();
        });
        window.addEventListener('mousemove', function(e) {
          if (!dragging || snippetLocked) return;
          windowPos = Math.max(0, Math.min(1, getCanvasX(e)));
          drawWaveform(wfData);
          updateDragGhostTime();
        });
        window.addEventListener('mouseup', function() { dragging = false; });

        wfCanvas.addEventListener('touchstart', function(e) {
          if (snippetLocked) return;
          dragging = true;
          windowPos = Math.max(0, Math.min(1, getCanvasX(e)));
          drawWaveform(wfData);
          updateDragGhostTime();
        }, { passive: true });
        window.addEventListener('touchmove', function(e) {
          if (!dragging || snippetLocked) return;
          windowPos = Math.max(0, Math.min(1, getCanvasX(e)));
          drawWaveform(wfData);
          updateDragGhostTime();
        }, { passive: true });
        window.addEventListener('touchend', function() { dragging = false; });

      var moveDurations = { PUNCH: 1, 'PUNCH+': 1, BLOCK: 1, SUPER: 1, TAUNT: 1, TAUNT_DEFAULT: 1, CONT: 1 };

        window.beat1Placements = [];
        window.redrawWaveforms = function() { drawWaveform(wfData); updateMoveSeq('move-seq-1', window.beat1Placements); if (window.debugEnabled) { window.updateDebugTimeline(); } };

        window.updateMoveSeq = function(elId, placements) {
          var el = document.getElementById(elId);
          var sorted = placements.slice().sort(function(a, b) { return a.tick - b.tick; });
          var moves = [];
          var prevMove = null;
          sorted.forEach(function(p) {
            if (p.moves) {
              p.moves.forEach(function(m, idx) {
                console.log('move:', m, 'prevMove:', prevMove, 'onSpike:', p.onSpike, 'idx:', idx);
                if (m === 'PUNCH' && p.onSpike && idx === 0) {
                  moves.push('PUNCH+');
                  prevMove = 'PUNCH+';
                } else if (m === 'PUNCH' && prevMove === 'TAUNT') {
                  moves.push('PUNCH+');
                  prevMove = 'PUNCH+';
                } else if (m !== 'IDLE' && m !== 'CONT') {
                  moves.push(m);
                  prevMove = m;
                }
              });
            }
          });
          console.log('final moves:', moves);
          el.innerHTML = moves.map(function(m) {
            var cls = m === 'PUNCH+' ? 'move-seq-item move-plus' : 'move-seq-item';
            return '<span class="' + cls + '">' + m + '</span>';
          }).join('');

          if (window.beat1Placements.length > 0 && window.beat2Placements.length > 0) {
            document.getElementById('start-btn').disabled = false;
          } else {
            document.getElementById('start-btn').disabled = true;
          }
        };
        window.getBeat1WindowPos = function() { return windowPos; };
        window.getBeat1Duration = function() { return wfDuration; };
        window.lockSnippet = function() { snippetLocked = true; wfCanvas.style.cursor = 'default'; };
        
        function formatTime(seconds) {
          var mins = Math.floor(seconds / 60);
          var secs = Math.floor(seconds % 60);
          return mins + ':' + (secs < 10 ? '0' : '') + secs;
        }
        
        window.updateDragGhostTime = function() {
          var display = document.getElementById('snippet-time-display');
          if (!display) return;
          display.style.display = 'block';
          var snippetStartSeconds = windowPos * (wfDuration - 30);
          var totalSeconds = wfDuration;
          display.textContent = formatTime(snippetStartSeconds) + ' / ' + formatTime(totalSeconds);
        };
      })();
    

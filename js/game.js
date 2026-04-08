    (function () {
      var canvas = document.getElementById("game-canvas");
      var gl, renderer, assetManager, skeletonRenderer;
      var hammer, maxx;
      var lastFrameTime = Date.now() / 1000;
      var animating = false;
      var pendingVote = null;
      var health = { maxx: 100, hammer: 100 };
      var hudScale = 1, charScale = 1;

      var timersEnded = false;

      function showVoteIfPending() {
        if (pendingVote && timersEnded) {
          var voteBtn = document.querySelector('.vote-btn[data-player="' + pendingVote + '"]');
          voteBtn.style.visibility = 'visible';
          voteBtn.classList.add('vote-visible');
          pendingVote = null;
        }
      }

      function setHealth(player, value) {
        health[player] = Math.max(0, value);
        document.querySelector('#' + player + '-health .health-bar-fill').style.width = health[player] + '%';
        if (health[player] === 0) {
          pendingVote = player === "maxx" ? "hammer" : "maxx";
          // Fade out hype video when character dies
          var hypeVideo = document.getElementById('hype-video');
          if (hypeVideo) {
            hypeVideo.style.opacity = '0';
          }
        }
      }

      function init() {
        var config = { alpha: true };
        gl = canvas.getContext("webgl", config) || canvas.getContext("experimental-webgl", config);
        if (!gl) {
          alert("WebGL not supported");
          return;
        }

        renderer = new spine.webgl.SceneRenderer(canvas, gl);
        assetManager = new spine.webgl.AssetManager(gl, "resources/");
        skeletonRenderer = new spine.webgl.SkeletonRenderer(gl);

        assetManager.loadTextureAtlas("HammerRigBox.atlas");
        assetManager.loadText("HammerRigBox.json");
        assetManager.loadTextureAtlas("MaxxRigBox.atlas");
        assetManager.loadText("MaxxRigBox.json");

        requestAnimationFrame(load);
      }

      function load() {
        if (!assetManager.isLoadingComplete()) {
          requestAnimationFrame(load);
          return;
        }

        hammer = createSkeleton("HammerRigBox", "Idle");
        maxx = createSkeleton("MaxxRigBox", "Idle");

        resize();
        window.addEventListener("resize", resize);
        setupButtons();
        updateRoundButtons();
        setupHealthWaveforms();
        requestAnimationFrame(render);
      }

      function setupHealthWaveforms() {
        var p1Canvas = document.getElementById('p1-waveform');
        var p2Canvas = document.getElementById('p2-waveform');
        if (!p1Canvas || !p2Canvas) return;
        
        window.updateHealthWaveforms = function() {
          var p1Data = window.wfData;    // Beat1.mp3
          var p2Data = window.b2Data;    // Beat2.mp3
          var p1Duration = window.wfDuration;  // Beat1 duration
          var p2Duration = window.b2Duration; // Beat2 duration
          
          // Resize canvases each frame in case layout changed
          var dpr = window.devicePixelRatio || 1;
          var w = p1Canvas.offsetWidth * dpr;
          var h = p1Canvas.offsetHeight * dpr;
          
          if (w === 0 || h === 0) return; // Skip if not laid out yet
          
          if (p1Canvas.width !== w) p1Canvas.width = w;
          if (p1Canvas.height !== h) p1Canvas.height = h;
          if (p2Canvas.width !== w) p2Canvas.width = w;
          if (p2Canvas.height !== h) p2Canvas.height = h;
          
          var p1Ctx = p1Canvas.getContext('2d');
          var p2Ctx = p2Canvas.getContext('2d');
          var bars = 30;
          var gap = 2 * dpr;
          var barW = (w / bars) - gap;
          
          // P1 - uses Beat1.mp3 with the exact 30-second window from waveform-zoom
          p1Ctx.clearRect(0, 0, w, h);
          if (p1Data && p1Duration) {
            var p1WindowPos = window.getBeat1WindowPos ? window.getBeat1WindowPos() : 0;
            var p1StartSample = p1WindowPos * (p1Duration - 30) / p1Duration * p1Data.length;
            var p1SamplesPerBar = p1Data.length / 30;
            
            var p1H = h * 0.8;
            var p1Mid = h;
            for (var i = 0; i < bars; i++) {
              var sampleStart = Math.floor(p1StartSample + i * p1SamplesPerBar);
              var sampleEnd = Math.floor(sampleStart + p1SamplesPerBar);
              var sum = 0;
              var count = 0;
              for (var s = sampleStart; s < sampleEnd && s < p1Data.length; s++) {
                sum += p1Data[s] * p1Data[s];
                count++;
              }
              var rms = count > 0 ? Math.sqrt(sum / count) : 0;
              var barH = Math.max(2 * dpr, rms * p1H * 3);
              p1Ctx.fillStyle = 'rgba(0, 229, 255, 0.6)';
              p1Ctx.fillRect(i * (barW + gap), p1Mid - barH, barW, barH);
            }
          }
          
          // P2 - uses Beat2.mp3 with the exact 30-second window from waveform-beat2
          p2Ctx.clearRect(0, 0, w, h);
          if (p2Data && p2Duration) {
            var p2Start = window.getBeat2Start ? window.getBeat2Start() : 0;
            var p2SamplesPerBar = p2Data.length / 30;
            
            var p2H = h * 0.8;
            var p2Mid = h;
            for (var j = 0; j < bars; j++) {
              var sampleStart = Math.floor(p2Start + j * p2SamplesPerBar);
              var sampleEnd = Math.floor(sampleStart + p2SamplesPerBar);
              var sum = 0;
              var count = 0;
              for (var s = sampleStart; s < sampleEnd && s < p2Data.length; s++) {
                sum += p2Data[s] * p2Data[s];
                count++;
              }
              var rms = count > 0 ? Math.sqrt(sum / count) : 0;
              var barH = Math.max(2 * dpr, rms * p2H * 3);
              p2Ctx.fillStyle = 'rgba(252, 108, 133, 0.6)';
              p2Ctx.fillRect(j * (barW + gap), p2Mid - barH, barW, barH);
            }
          }
        };
      }

      function setButtonsDisabled(disabled) {
        document.querySelectorAll('.action-btn').forEach(function(btn) {
          btn.disabled = disabled;
        });
      }

      function playAnimationOnce(character, animName) {
        character.state.setAnimation(0, animName, false);
      }

      var bgSlot = 'a';

      function setupManualLoop(video) {
        video.addEventListener('timeupdate', function() {
          if (video.duration && video.currentTime >= video.duration - 0.15) {
            video.currentTime = 0;
          }
        });
      }

      function switchBackground(src, loop) {
        var cur = document.getElementById('bg-video-' + bgSlot);
        var nxt = document.getElementById('bg-video-' + (bgSlot === 'a' ? 'b' : 'a'));

        nxt.src = src;
        nxt.load();

        function onCanPlay() {
          nxt.removeEventListener('canplay', onCanPlay);
          nxt.play().catch(function() {});
          nxt.style.zIndex = 0;
          cur.style.zIndex = -1;
          cur.pause();
          bgSlot = bgSlot === 'a' ? 'b' : 'a';

          if (loop) {
            setupManualLoop(nxt);
          } else {
            nxt.addEventListener('timeupdate', function onNearEnd() {
              if (nxt.duration && nxt.currentTime >= nxt.duration - 0.5) {
                nxt.removeEventListener('timeupdate', onNearEnd);
                switchBackground('resources/arena_idle.webm', true);
              }
            });
          }
        }

        nxt.addEventListener('canplay', onCanPlay);
      }

      // Manual loop for the initial idle video
      setupManualLoop(document.getElementById('bg-video-a'));

      function playAnimationThenIdle(character, animName, onComplete) {
        character.state.setAnimation(0, animName, false);
        character.state.addAnimation(0, "Idle", true, 0);
        var listener = {
          complete: function(trackEntry) {
            if (trackEntry.animation.name === animName) {
              character.state.removeListener(listener);
              if (onComplete) onComplete();
            }
          }
        };
        character.state.addListener(listener);
      }

      var moveAnimMap = { PUNCH: 'Punch', 'PUNCH+': 'Punch+', BLOCK: 'Block', SUPER: 'Super', TAUNT: 'Taunt', TAUNT_DEFAULT: 'Taunt', CONT: 'SuperInt' };

      var animLookup = {
        'PUNCH:Idle':    'PUNCH:HIT',
        'PUNCH:TAUNT':   'PUNCH:HIT',
        'PUNCH:TAUNT_DEFAULT': 'PUNCH:HIT',
        'PUNCH:SUPER':   'PUNCH:HIT',
        'PUNCH:PUNCH':   'PARRY:PARRY',
        'PUNCH+:Idle':   'PUNCH+:HIT',
        'PUNCH+:Block':  'PUNCH+:HIT',
        'PUNCH+:PUNCH':  'PUNCH+:HIT',
        'PUNCH+:TAUNT':  'PUNCH+:HIT',
        'PUNCH+:TAUNT_DEFAULT': 'PUNCH+:HIT',
        'PUNCH+:SUPER':  'PUNCH+:HIT',
        'PUNCH+:PUNCH+': 'PARRY:PARRY',
        'BLOCK:Idle':    'BLOCK:IDLE',
        'BLOCK:TAUNT':   'BLOCK:TAUNT',
        'BLOCK:TAUNT_DEFAULT': 'BLOCK:TAUNT',
        'BLOCK:PUNCH':   'DEFLECT:PUNCH',
        'BLOCK:PUNCH+':  'HIT:PUNCH+',
        'BLOCK:SUPER':   'DOWN:SUPER',
        'SUPER:Idle':    'SUPER:HIT',
        'SUPER:Block':   'SUPER:DOWN',
        'SUPER:TAUNT':   'SUPER:DOWN',
        'SUPER:TAUNT_DEFAULT': 'SUPER:DOWN',
        'CONT:Idle':     'CONT:HIT',
        'CONT:Block':    'CONT:HIT',
        'CONT:TAUNT':    'CONT:HIT',
        'CONT:TAUNT_DEFAULT': 'CONT:HIT',
        'CONT:PUNCH':    'CONT:HIT',
        'TAUNT:PUNCH':   'TAUNT:HIT',
        'TAUNT:SUPER':   'TAUNT:HIT',
        'TAUNT_DEFAULT:PUNCH': 'TAUNT:HIT',
        'TAUNT_DEFAULT:SUPER': 'TAUNT:HIT',
        'Idle:PUNCH':    'HIT:PUNCH',
        'Idle:PUNCH+':   'HIT:PUNCH+'
      };

      var rigAnimMap = {
        PUNCH: 'Punch', 'PUNCH+': 'Punch+', BLOCK: 'Block', SUPER: 'Super', TAUNT: 'Taunt', TAUNT_DEFAULT: 'Taunt', CONT: 'SuperInt',
        HIT: 'Hit', PARRY: 'Parry', DEFLECT: 'Deflect', DOWN: 'Down', IDLE: 'Idle',
        SUPERINT: 'SuperInt', SUPERINT2: 'SuperInt2'
      };

      var superInterruptAnims = ['Parry', 'SuperInt', 'SuperInt2'];

      function playSequence(character, moves, idx) {
        if (idx >= moves.length) return;
        var anim = moveAnimMap[moves[idx]] || 'Punch';
        playAnimationThenIdle(character, anim, function() {
          playSequence(character, moves, idx + 1);
        });
      }

      var moveDurations = { PUNCH: 1, 'PUNCH+': 1, BLOCK: 1, SUPER: 1, TAUNT: 1, TAUNT_DEFAULT: 1, CONT: 1 };

      function generateTicks(cards) {
        var ticks = [];
        for (var i = 0; i < 30; i++) {
          ticks.push({ move: 'Idle', cardStart: false, cardIdx: -1 });
        }
        var sorted = cards.slice().sort(function(a, b) { return a.tick - b.tick; });
        
        sorted.forEach(function(c, cIdx) {
          var startIdx = c.tick - 1;
          var moves = c.moves || [];
          
          for (var m = 0; m < moves.length; m++) {
            var idx = startIdx + m;
            if (idx >= 0 && idx < 30) {
              ticks[idx] = { move: moves[m], cardStart: m === 0, cardIdx: cIdx, onSpike: c.onSpike && m === 0 };
            }
          }
        });
        
        return ticks;
      }

      function getCombatAnims(atkMove, defMove, atkInterrupted, defInterrupted, atkTickInMove, defTickInMove) {
        var key = atkMove + ':' + defMove;
        if (animLookup[key]) {
          var parts = animLookup[key].split(':');
          return { atk: rigAnimMap[parts[0]] || parts[0], def: rigAnimMap[parts[1]] || parts[1] };
        }
        return {
          atk: atkInterrupted ? 'Hit' : (rigAnimMap[atkMove] || atkMove),
          def: defInterrupted ? 'Hit' : (rigAnimMap[defMove] || defMove)
        };
      }

      function buildTimedSequence(cards) {
        var events = [];
        cards.forEach(function(c) {
          var moves = c.moves || [];
          moves.forEach(function(m, idx) {
            var move = m;
            if (m === 'PUNCH' && c.onSpike && idx === 0) move = 'PUNCH+';
            events.push({ move: move, duration: moveDurations[move] || 1 });
          });
          events.push({ move: 'Idle', duration: c.downtime || 1 });
        });
        return events;
      }

      function getSortedCards(placements) {
        return placements.slice().sort(function(a, b) { return a.tick - b.tick; });
      }

      function playTimedSequence(character, events, idx) {
        if (idx >= events.length) return;
        var ev = events[idx];
        var anim = moveAnimMap[ev.move] || ev.move;
        character.state.setAnimation(0, anim, anim === 'Idle');
        setTimeout(function() {
          playTimedSequence(character, events, idx + 1);
        }, ev.duration * 1000);
      }

      // ===== COMBAT RULES =====
      // Format: [atkMove, defMove] -> { atkMove: 'newMove', anim: 'newAnim', defMove: 'newMove', defAnim: 'newAnim' }
      // null means no change, 'REMOVE' means set to idle
      window.punchDamageBase = 20;
      window.punchPlusDamageBase = 34;
      window.p1PunchDamageModifier = 0;
      window.p1PunchPlusDamageModifier = 0;
      window.p2PunchDamageModifier = 0;
      window.p2PunchPlusDamageModifier = 0;
      var combatRules = [
        // BLOCK vs PUNCH -> Defender deflects, attacker idles but keeps punch anim
        [['PUNCH', 'BLOCK'], { atkMove: 'Idle', atkAnim: 'Punch', defAnim: 'Deflect' }],
        [['PUNCH+', 'BLOCK'], { atkMove: 'Idle', atkAnim: 'Punch+', defAnim: 'Hit' }],
        
        // PUNCH vs PUNCH -> Both parry
        [['PUNCH', 'PUNCH'], { atkAnim: 'Parry', defAnim: 'Parry' }],
        [['PUNCH+', 'PUNCH+'], { atkAnim: 'Parry', defAnim: 'Parry' }],
        
        // PUNCH vs IDLE -> PUNCH hits, deals damage
        [['PUNCH', 'Idle'], { atkAnim: 'Punch', defAnim: 'Hit', atkDamage: window.punchDamageBase }],
        [['PUNCH+', 'Idle'], { atkAnim: 'Punch+', defAnim: 'Hit', atkDamage: window.punchPlusDamageBase }],
        
        // PUNCH vs TAUNT -> PUNCH hits, TAUNT gets hit and goes idle
        [['PUNCH', 'TAUNT'], { atkAnim: 'Punch', defMove: 'Idle', defAnim: 'Hit' }],
        [['PUNCH+', 'TAUNT'], { atkAnim: 'Punch+', defMove: 'Idle', defAnim: 'Hit', atkDamage: 15 }],
        
        // TAUNT vs PUNCH+ (same tick) -> TAUNT gets hit
        [['TAUNT', 'PUNCH+'], { atkAnim: 'Hit' }],
        
        // SUPER vs PUNCH -> SUPER interrupted to Idle with Hit
        [['SUPER', 'PUNCH'], { atkMove: 'Idle', atkAnim: 'Hit' }],
        [['SUPER', 'PUNCH+'], { atkMove: 'Idle', atkAnim: 'Hit' }],
        
        // Idle with continue vs PUNCH -> SUPER continues with SuperInt animation
        [['Idle', 'PUNCH'], { atkMove: 'Idle', atkAnim: 'SuperInt' }],
        
        // BLOCK vs SUPER -> defender down
        [['BLOCK', 'SUPER'], { defAnim: 'Down' }],
        
        // Idle with continue follows the animation of previous move
      ];

      // Apply rules to timeline
      function applyCombatRules(timeline) {
        var result = [];
        
        for (var t = 0; t < timeline.length; t++) {
          console.log('applyCombatRules tick', t);
          var entry = timeline[t];
          var newEntry = { 
            tick: entry.tick || (t + 1),
            p1: { move: entry.p1.move, anim: entry.p1.anim, fromTick: entry.p1.fromTick, continueAnim: entry.p1.continueAnim },
            p2: { move: entry.p2.move, anim: entry.p2.anim, fromTick: entry.p2.fromTick, continueAnim: entry.p2.continueAnim }
          };
          
          // TAUNT on P1 turns P1's own PUNCH 3 ticks later into PUNCH+ (only first one)
          if (entry.p1.move === 'PUNCH') {
            // Check if there's a TAUNT in the window AND we haven't already converted a PUNCH from this TAUNT
            var p1TauntUsed = false;
            for (var back = Math.max(0, t - 5); back < t; back++) {
              if (result[back] && (result[back].p1.move === 'TAUNT' || result[back].p2.move === 'TAUNT')) {
                // Check if this TAUNT already converted a PUNCH
                for (var check = back + 1; check < t; check++) {
                  if (result[check] && result[check].p1.move === 'PUNCH+') {
                    p1TauntUsed = true;
                    break;
                  }
                }
                if (!p1TauntUsed) {
                  newEntry.p1.move = 'PUNCH+';
                  newEntry.p1.anim = 'Punch+';
                  newEntry.p1.damage = window.punchPlusDamageBase;
                  break;
                }
              }
            }
          }
          // TAUNT on P2 turns P2's own PUNCH 3 ticks later into PUNCH+ (only first one)
          if (entry.p2.move === 'PUNCH') {
            var p2TauntUsed = false;
            for (var back = Math.max(0, t - 5); back < t; back++) {
              if (result[back] && (result[back].p2.move === 'TAUNT' || result[back].p1.move === 'TAUNT')) {
                for (var check = back + 1; check < t; check++) {
                  if (result[check] && result[check].p2.move === 'PUNCH+') {
                    p2TauntUsed = true;
                    break;
                  }
                }
                if (!p2TauntUsed) {
                  newEntry.p2.move = 'PUNCH+';
                  newEntry.p2.anim = 'Punch+';
                  newEntry.p2.damage = window.punchPlusDamageBase;
                  break;
                }
              }
            }
          }
 
          // SUPER deals 100% damage on tick 2 after SUPER (3rd tick)
          var prev2P1 = 'none';
          var prev2P2 = 'none';
          var p1SuperInterrupted = false;
          var p2SuperInterrupted = false;
          var p1SuperHitNextTick = false;
          var p2SuperHitNextTick = false;
          if (t >= 2) {
            var checkTick = t - 2;
            // Check result array (processed) not timeline for the SUPER position
            var timelineEntry = result[checkTick];
            prev2P1 = timelineEntry ? timelineEntry.p1.move : 'none';
            prev2P2 = timelineEntry ? timelineEntry.p2.move : 'none';
            
            // Check if SUPER was interrupted (changed to Idle) in result before this tick
            for (var check = t - 1; check > checkTick; check--) {
              console.log('Checking result[' + check + ']:', result[check]);
              if (result[check] && result[check].p1.move === 'Idle' && result[check].p1.anim === 'Hit') {
                p1SuperInterrupted = true;
              }
              if (result[check] && result[check].p2.move === 'Idle' && result[check].p2.anim === 'Hit') {
                p2SuperInterrupted = true;
              }
              // Also check if SUPER was hit by PUNCH on the immediate next tick (tick N+1)
              if (result[check] && result[check].p2.move === 'PUNCH' && timelineEntry && timelineEntry.p1.move === 'SUPER') {
                p1SuperHitNextTick = true;
              }
              if (result[check] && result[check].p1.move === 'PUNCH' && timelineEntry && timelineEntry.p2.move === 'SUPER') {
                p2SuperHitNextTick = true;
              }
            }
            console.log('After check: p1SuperInterrupted=' + p1SuperInterrupted + ' p1SuperHitNextTick=' + p1SuperHitNextTick);
          }
          
          // If this is 2 ticks after SUPER, deal 100% damage (unless SUPER was interrupted or hit next tick)
          var p1SuperHitNextTickNow = entry.p1.move === 'SUPER' && timeline[t + 1] && timeline[t + 1].p2.move === 'PUNCH';
          var p2SuperHitNextTickNow = entry.p2.move === 'SUPER' && timeline[t + 1] && timeline[t + 1].p1.move === 'PUNCH';
          console.log('SUPER check t=' + t + ' prev2P1=' + prev2P1 + ' interrupted=' + p1SuperInterrupted + ' hitNext=' + p1SuperHitNextTick);
          if ((!p1SuperInterrupted && !p1SuperHitNextTick && !p1SuperHitNextTickNow) && (entry.p1.move === 'Idle' || entry.p1.move === 'IDLE' || entry.p1.move === 'CONT') && prev2P1 === 'SUPER') {
            newEntry.p1.damage = 100;
            console.log('-> Setting P1 damage to 100!');
          }
          if ((!p2SuperInterrupted && !p2SuperHitNextTick && !p2SuperHitNextTickNow) && (entry.p2.move === 'Idle' || entry.p2.move === 'IDLE' || entry.p2.move === 'CONT') && prev2P2 === 'SUPER') {
            newEntry.p2.damage = 100;
            console.log('-> Setting P2 damage to 100!');
          }
          
          // If SUPER was hit on next tick, change animation to SuperInt (on the SUPER tick itself)
          if (entry.p1.move === 'SUPER' && timeline[t + 1] && timeline[t + 1].p2.move === 'PUNCH') {
            newEntry.p1.anim = 'SuperInt';
          }
          if (entry.p2.move === 'SUPER' && timeline[t + 1] && timeline[t + 1].p1.move === 'PUNCH') {
            newEntry.p2.anim = 'SuperInt';
          }

          // Handle continueAnim flag FIRST - continue previous animation before any rules
          if (entry.p1.continueAnim && t > 0 && result[t-1]) {
            newEntry.p1.anim = 'cont';
          }
          if (entry.p2.continueAnim && t > 0 && result[t-1]) {
            newEntry.p2.anim = 'cont';
          }

          // Idle+cont after TAUNT (not matching any other rule) -> goes Idle
          if (entry.p1.move === 'Idle' && entry.p1.continueAnim && t > 0 && result[t-1] && (result[t-1].p1.move === 'TAUNT' || result[t-1].p1.move === 'TAUNT_DEFAULT')) {
            newEntry.p1.move = 'Idle';
            newEntry.p1.anim = 'Idle';
          }
          if (entry.p2.move === 'Idle' && entry.p2.continueAnim && t > 0 && result[t-1] && (result[t-1].p2.move === 'TAUNT' || result[t-1].p2.move === 'TAUNT_DEFAULT')) {
            newEntry.p2.move = 'Idle';
            newEntry.p2.anim = 'Idle';
          }
          
          // Also keep CONT rules for backwards compatibility with cards
          // CONT after TAUNT
          if (entry.p1.move === 'CONT' && t > 0 && result[t-1] && (result[t-1].p1.move === 'TAUNT' || result[t-1].p1.move === 'TAUNT_DEFAULT')) {
            newEntry.p1.move = 'Idle';
            newEntry.p1.anim = 'Idle';
          }
          if (entry.p2.move === 'CONT' && t > 0 && result[t-1] && (result[t-1].p2.move === 'TAUNT' || result[t-1].p2.move === 'TAUNT_DEFAULT')) {
            newEntry.p2.move = 'Idle';
            newEntry.p2.anim = 'Idle';
          }
          
          // Find matching rule (check both directions)
          var ruleFound = false;
          for (var r = 0; r < combatRules.length; r++) {
            var rule = combatRules[r];
            var moves = rule[0];
            
            // Skip Idle vs Idle rule unless both have continueAnim
            if (moves[0] === 'Idle' && moves[1] === 'Idle') {
              if (!(entry.p1.continueAnim && entry.p2.continueAnim)) {
                continue;
              }
            }
            
            // Check forward direction
            if (moves[0] === entry.p1.move && moves[1] === entry.p2.move) {
              var changes = rule[1];
              if (changes.atkMove) newEntry.p1.move = changes.atkMove === 'REMOVE' ? 'Idle' : changes.atkMove;
              // Only override anim if rule specifies one AND entry isn't explicitly 'cont' or 'Punch+'
              if (changes.atkAnim && newEntry.p1.anim !== 'cont' && newEntry.p1.anim !== 'Punch+') newEntry.p1.anim = changes.atkAnim;
              if (changes.defMove) newEntry.p2.move = changes.defMove === 'REMOVE' ? 'Idle' : changes.defMove;
              if (changes.defAnim && newEntry.p2.anim !== 'cont' && newEntry.p2.anim !== 'Punch+') newEntry.p2.anim = changes.defAnim;
              // Only set damage if not already set (preserve 25 from PUNCH+)
              if (!newEntry.p1.damage) newEntry.p1.damage = changes.atkDamage || 0;
              if (!newEntry.p2.damage) newEntry.p2.damage = changes.defDamage || 0;
              ruleFound = true;
              break;
            }
            // Check reverse direction
            if (moves[0] === entry.p2.move && moves[1] === entry.p1.move) {
              var changes = rule[1];
              if (changes.defMove) newEntry.p1.move = changes.defMove === 'REMOVE' ? 'Idle' : changes.defMove;
              if (changes.defAnim && newEntry.p1.anim !== 'cont' && newEntry.p1.anim !== 'Punch+') newEntry.p1.anim = changes.defAnim;
              if (changes.atkMove) newEntry.p2.move = changes.atkMove === 'REMOVE' ? 'Idle' : changes.atkMove;
              if (changes.atkAnim && newEntry.p2.anim !== 'cont' && newEntry.p2.anim !== 'Punch+') newEntry.p2.anim = changes.atkAnim;
              // Only set damage if not already set (preserve 25 from PUNCH+)
              if (!newEntry.p1.damage) newEntry.p1.damage = changes.defDamage || 0;
              if (!newEntry.p2.damage) newEntry.p2.damage = changes.atkDamage || 0;
              ruleFound = true;
              break;
            }
          }
          
          // Handle CONT - follows previous animation
          if (newEntry.p1.move === 'CONT' && t > 0) {
            newEntry.p1.anim = result[t-1].p1.anim;
          }
          if (newEntry.p2.move === 'CONT' && t > 0) {
            newEntry.p2.anim = result[t-1].p2.anim;
          }
          
          // IDLE default animation (only if not already set by rule)
          if (newEntry.p1.move === 'Idle' && !newEntry.p1.anim) newEntry.p1.anim = 'Idle';
          if (newEntry.p2.move === 'Idle' && !newEntry.p2.anim) newEntry.p2.anim = 'Idle';
          
          result.push(newEntry);
        }
        
        return result;
      }

      function generateTicks(cards) {
        var ticks = [];
        for (var i = 0; i < 30; i++) {
          ticks.push({ move: 'Idle', cardStart: false, cardIdx: -1 });
        }
        var sorted = cards.slice().sort(function(a, b) { return a.tick - b.tick; });
        
        sorted.forEach(function(c, cIdx) {
          var startIdx = c.tick - 1;
          var moves = c.moves || [];
          
          for (var m = 0; m < moves.length; m++) {
            var idx = startIdx + m;
            if (idx >= 0 && idx < 30) {
              ticks[idx] = { move: moves[m], cardStart: m === 0, cardIdx: cIdx, onSpike: c.onSpike && m === 0, anim: c.anim };
            }
          }
        });
        
        return ticks;
      }

      function processCombat(atkTicks, defTicks, roundNum) {
        // Create initial timeline
        var timeline = [];
        for (var t = 0; t < 30; t++) {
          var atkTick = atkTicks[t] || { move: 'Idle', cardStart: false };
          var defTick = defTicks[t] || { move: 'Idle', cardStart: false };
          
          // OnSpike: first PUNCH of card on spike becomes PUNCH+
          if (atkTick.move === 'PUNCH' && atkTick.onSpike) {
            atkTick.move = 'PUNCH+';
          }
          if (defTick.move === 'PUNCH' && defTick.onSpike) {
            defTick.move = 'PUNCH+';
          }
          
          // Custom animation from editor (includes 'cont' for continue)
          if (atkTick.anim) {
            if (atkTick.anim === 'cont') {
              atkTick.continueAnim = true;
            } else {
              atkTick.customAnim = atkTick.anim;
            }
          }
          if (defTick.anim) {
            if (defTick.anim === 'cont') {
              defTick.continueAnim = true;
            } else {
              defTick.customAnim = defTick.anim;
            }
          }
          
          // Determine animations based on moves
          // If continueAnim is true, use 'cont' to preserve the continue state
          var atkAnim = atkTick.continueAnim ? 'cont' : (atkTick.customAnim || rigAnimMap[atkTick.move] || 'Idle');
          var defAnim = defTick.continueAnim ? 'cont' : (defTick.customAnim || rigAnimMap[defTick.move] || 'Idle');
          
          // CONT/continue - continue previous animation
          var fromTick = null;
          if (atkTick.move === 'CONT' && t > 0) {
            atkAnim = 'CONT';
            fromTick = t;
          }
          if (defTick.move === 'CONT' && t > 0) {
            defAnim = 'CONT';
          }
          
          timeline.push({
            p1: { move: atkTick.move, anim: atkAnim, fromTick: fromTick, continueAnim: atkTick.continueAnim },
            p2: { move: defTick.move, anim: defAnim, fromTick: null, continueAnim: defTick.continueAnim }
          });
        }
        
        // Apply combat rules
        var finalTimeline = applyCombatRules(timeline);
        
        // Convert to old format for now
        var results = [];
        for (var i = 0; i < finalTimeline.length; i++) {
          var p1Anim = finalTimeline[i].p1.anim;
          var p2Anim = finalTimeline[i].p2.anim;
          var p1Move = finalTimeline[i].p1.move;
          var p2Move = finalTimeline[i].p2.move;
          var prevP1Move = i > 0 ? finalTimeline[i-1].p1.move : 'none';
          var prevP2Move = i > 0 ? finalTimeline[i-1].p2.move : 'none';
          var prevP1Anim = i > 0 ? finalTimeline[i-1].p1.anim : 'none';
          var prevP2Anim = i > 0 ? finalTimeline[i-1].p2.anim : 'none';
          
          // If move is CONT, set cont
          if (p1Move === 'CONT') {
            p1Anim = 'cont';
          }
          // If move is Idle (or IDLE) and previous was not Idle (and not CONT), set cont
          // BUT don't continue after PUNCH+, PUNCH, or BLOCK - let animation end naturally
          if ((p1Move === 'Idle' || p1Move === 'IDLE') && prevP1Move !== 'Idle' && prevP1Move !== 'IDLE' && prevP1Move !== 'CONT' && i > 0) {
            if (prevP1Move !== 'PUNCH+' && prevP1Move !== 'PUNCH' && prevP1Move !== 'BLOCK') {
              p1Anim = 'cont';
            }
          }
          
          if (p2Move === 'CONT') {
            p2Anim = 'cont';
          }
          if ((p2Move === 'Idle' || p2Move === 'IDLE') && prevP2Move !== 'Idle' && prevP2Move !== 'IDLE' && prevP2Move !== 'CONT' && i > 0) {
            if (prevP2Move !== 'PUNCH+' && prevP2Move !== 'PUNCH' && prevP2Move !== 'BLOCK') {
              p2Anim = 'cont';
            }
          }
          
          // For first tick (i===0), if animation is Idle, use cont to avoid restarting
          if (i === 0 && p1Anim === 'Idle') p1Anim = 'cont';
          if (i === 0 && p2Anim === 'Idle') p2Anim = 'cont';
          results.push({
            atkMove: finalTimeline[i].p1.move,
            defMove: finalTimeline[i].p2.move,
            atkAnim: p1Anim,
            defAnim: p2Anim,
            atkDamage: finalTimeline[i].p1.damage || 0,
            defDamage: finalTimeline[i].p2.damage || 0
          });
        }
        
        return results;
      }

      var debugTickInterval = null;

      // Format move with tick for display
      function formatMove(entry, tick) {
        var move = entry.move;
        var anim = entry.anim;
        tick = tick || 1;
        
        if (move === 'CONT') {
          // Show as IDLE(tick, cont) for continue
          return 'IDLE(' + tick + ',cont)';
        }
        if (anim === 'cont') {
          return 'IDLE(' + tick + ',cont)';
        }
        return move + '(' + tick + ',' + anim + ')';
      }

      function showDebugTimeline(timeline, roundNum, autoPlay, showBox) {
        if (debugTickInterval) clearInterval(debugTickInterval);
        var p1List = document.getElementById('debug-p1-list');
        var p2List = document.getElementById('debug-p2-list');
        p1List.innerHTML = '';
        p2List.innerHTML = '';
        if (showBox || window.debugEnabled) document.getElementById('debug-boxes').style.display = 'flex';

        // Normalize timeline to new format if needed
        var processedTimeline;
        if (timeline[0] && timeline[0].p1) {
          processedTimeline = applyCombatRules(timeline);
        } else {
          // Convert old format to new format
          var normalized = timeline.map(function(r, t) {
            return {
              tick: r.tick || (t + 1),
              p1: { move: r.atkMove, anim: r.atkAnim, fromTick: null, originalMove: r.atkMove },
              p2: { move: r.defMove, anim: r.defAnim, fromTick: null, originalMove: r.defMove }
            };
          });
          // Apply rules BEFORE converting to continue, so Idle changes are preserved
          var afterRules = applyCombatRules(normalized);
          // Now convert to IDLE(tick, cont) format - first stays Idle, others use cont if Idle
          normalized = afterRules.map(function(r, t) {
            var newP1 = Object.assign({}, r.p1);
            var newP2 = Object.assign({}, r.p2);
            // First entry uses cont for Idle (matching actual combat behavior)
            if (t === 0) {
              newP1.move = 'Idle';
              newP1.anim = 'cont';
              newP2.move = 'Idle';
              newP2.anim = 'cont';
            } else {
              // Keep actual moves, only convert Idle to continue
              if (r.p1.move === 'Idle') {
                newP1.move = 'Idle';
                newP1.anim = 'cont';
              }
              if (r.p2.move === 'Idle') {
                newP2.move = 'Idle';
                newP2.anim = 'cont';
              }
            }
            return { tick: r.tick, p1: newP1, p2: newP2 };
          });
          processedTimeline = normalized;
        }

        processedTimeline.forEach(function(r, i) {
          var tick = r.tick || (i + 1);
          var p1Entry, p2Entry;
          if (roundNum === 1) {
            p1Entry = r.p1;
            p2Entry = r.p2;
          } else {
            p1Entry = r.p2;
            p2Entry = r.p1;
          }
          
          var p1Display = formatMove(p1Entry, tick) + ':' + formatMove(p2Entry, tick);
          
          var row1 = document.createElement('div');
          row1.className = 'debug-row';
          row1.id = 'p1-' + i;
          row1.dataset.idx = i;
          row1.innerHTML = '<span class="dm">' + p1Display + '</span>';
          row1.addEventListener('mouseenter', function() {
            document.querySelectorAll('.debug-row.hover').forEach(function(el) { el.classList.remove('hover'); });
            var idx = this.dataset.idx;
            this.classList.add('hover');
            var other = document.getElementById('p2-' + idx);
            if (other) other.classList.add('hover');
          });
          row1.addEventListener('mouseleave', function() {
            document.querySelectorAll('.debug-row.hover').forEach(function(el) { el.classList.remove('hover'); });
          });
          p1List.appendChild(row1);

          var row2 = document.createElement('div');
          row2.className = 'debug-row';
          row2.id = 'p2-' + i;
          row2.dataset.idx = i;
          row2.innerHTML = '<span class="dm">' + p1Display.split(':')[1] + '</span>';
          row2.addEventListener('mouseenter', function() {
            document.querySelectorAll('.debug-row.hover').forEach(function(el) { el.classList.remove('hover'); });
            var idx = this.dataset.idx;
            this.classList.add('hover');
            var other = document.getElementById('p1-' + idx);
            if (other) other.classList.add('hover');
          });
          row2.addEventListener('mouseleave', function() {
            document.querySelectorAll('.debug-row.hover').forEach(function(el) { el.classList.remove('hover'); });
          });
          p2List.appendChild(row2);
        });

        if (autoPlay) {
          var tickIdx = 0;
          debugTickInterval = setInterval(function() {
            if (tickIdx >= timeline.length) {
              clearInterval(debugTickInterval);
              return;
            }
            var prev = tickIdx - 1;
            if (prev >= 0) {
              var p1 = document.getElementById('p1-' + prev);
              var p2 = document.getElementById('p2-' + prev);
              if (p1) p1.classList.remove('active');
              if (p2) p2.classList.remove('active');
            }
            var c1 = document.getElementById('p1-' + tickIdx);
            var c2 = document.getElementById('p2-' + tickIdx);
            if (c1) { c1.classList.add('active'); c1.scrollIntoView({ block: 'nearest' }); }
            if (c2) { c2.classList.add('active'); c2.scrollIntoView({ block: 'nearest' }); }
            tickIdx++;
          }, 1000);
        }
      }

      function playCombat(atkChar, defChar, combatResults, roundNum) {
        var idx = 0;
        var lastAtkAnim = '';
        var lastDefAnim = '';

        var combatInterval = setInterval(function() {
          if (idx >= combatResults.length) {
            clearInterval(combatInterval);
            return;
          }
          var r = combatResults[idx];

          // cont = skip setAnimation entirely (continue previous animation)
          // Same animation as last tick = skip (allows looping)
          if (r.atkAnim === 'cont') {
            // skip - let previous animation continue
          } else if (r.atkAnim !== lastAtkAnim) {
            atkChar.state.setAnimation(0, r.atkAnim, true);
            lastAtkAnim = r.atkAnim;
          }
          
          if (r.defAnim === 'cont') {
            // skip - let previous animation continue
          } else if (r.defAnim !== lastDefAnim) {
            defChar.state.setAnimation(0, r.defAnim, true);
            lastDefAnim = r.defAnim;
          }

          // Apply damage at end of second - delayed for punch attacks
          var damageDelay = (r.atkAnim === 'Punch' || r.atkAnim === 'Punch+' || r.defAnim === 'Punch' || r.defAnim === 'Punch+') ? 200 : 0;
          setTimeout(function() {
            if (r.atkDamage > 0 || r.defDamage > 0) {
              var atkTarget = roundNum === 1 ? 'hammer' : 'maxx';
              var defTarget = roundNum === 1 ? 'maxx' : 'hammer';

              // Apply punch damage modifier based on attacker
              var atkDamage = r.atkDamage;
              var defDamage = r.defDamage;
              
              if (roundNum === 1) {
                // maxx is attacking
                if (r.atkAnim === 'Punch') atkDamage += window.p1PunchDamageModifier;
                if (r.atkAnim === 'Punch+') atkDamage += window.p1PunchPlusDamageModifier;
                if (r.defAnim === 'Punch') defDamage += window.p2PunchDamageModifier;
                if (r.defAnim === 'Punch+') defDamage += window.p2PunchPlusDamageModifier;
              } else {
                // hammer is attacking
                if (r.atkAnim === 'Punch') atkDamage += window.p2PunchDamageModifier;
                if (r.atkAnim === 'Punch+') atkDamage += window.p2PunchPlusDamageModifier;
                if (r.defAnim === 'Punch') defDamage += window.p1PunchDamageModifier;
                if (r.defAnim === 'Punch+') defDamage += window.p1PunchPlusDamageModifier;
              }

              if (atkDamage > 0) {
                var newH = Math.max(0, health[atkTarget] - atkDamage);
                setHealth(atkTarget, newH);
                // Mess up audio when specific player takes damage
                // Round 1: only when maxx (player1) loses health (atkTarget === 'maxx')
                // Round 2: only when hammer (player2) loses health (atkTarget === 'hammer')
                if (roundNum === 1 && atkTarget === 'maxx') {
                  audio1.volume = 0.1;
                  if (newH > 0) {
                    setTimeout(function() { audio1.volume = 1; }, 500);
                  }
                } else if (roundNum === 2 && atkTarget === 'hammer') {
                  audio2.volume = 0.1;
                  if (newH > 0) {
                    setTimeout(function() { audio2.volume = 1; }, 500);
                  }
                }
                if (newH <= 0) {
                  clearInterval(combatInterval);
                  var loser = atkTarget === 'maxx' ? maxx : hammer;
                  var winner = atkTarget === 'maxx' ? hammer : maxx;
                  loser.state.setAnimation(0, 'Down', false);
                  winner.state.setAnimation(0, 'Idle', true);
                  // Show K.O. when health reaches 0
                  var ko = document.getElementById('ko-overlay');
                  koAudio.play().catch(function() {});
                  ko.classList.add('visible');
                  setTimeout(function() { ko.classList.add('blink-out'); }, 1500);
                  setTimeout(function() { ko.classList.remove('visible', 'blink-out'); }, 1800);
                  return;
                }
              }

              if (defDamage > 0) {
                var newH2 = Math.max(0, health[defTarget] - defDamage);
                setHealth(defTarget, newH2);
                if (roundNum === 1 && defTarget === 'maxx') {
                  audio1.volume = 0.1;
                  if (newH2 > 0) {
                    setTimeout(function() { audio1.volume = 1; }, 500);
                  }
                } else if (roundNum === 2 && defTarget === 'hammer') {
                  audio2.volume = 0.1;
                  if (newH2 > 0) {
                    setTimeout(function() { audio2.volume = 1; }, 500);
                  }
                }
                if (newH2 <= 0) {
                  clearInterval(combatInterval);
                  var loser2 = defTarget === 'maxx' ? maxx : hammer;
                  var winner2 = defTarget === 'maxx' ? hammer : maxx;
                  loser2.state.setAnimation(0, 'Down', false);
                  winner2.state.setAnimation(0, 'Idle', true);
                  // Show K.O. when health reaches 0
                  var ko = document.getElementById('ko-overlay');
                  koAudio.play().catch(function() {});
                  ko.classList.add('visible');
                  setTimeout(function() { ko.classList.add('blink-out'); }, 1500);
                  setTimeout(function() { ko.classList.remove('visible', 'blink-out'); }, 1800);
                  return;
                }
              }
            }
          }, 150 + damageDelay);
          idx++;
        }, 1000);
        window.currentCombatInterval = combatInterval;
      }

      function fireAction(attacker, defender, attackAnim, defendAnim) {
        if (animating) return;
        animating = true;
        var completed = 0;
        function onComplete() {
          if (++completed >= 2) {
            animating = false;
            showVoteIfPending();
          }
        }
        playAnimationThenIdle(attacker, attackAnim, onComplete);
        playAnimationThenIdle(defender, defendAnim, onComplete);
      }

      function setupButtons() {
        document.querySelectorAll('.action-btn[data-action="fyre"]').forEach(function(btn) {
          btn.addEventListener("click", function() {
          });
        });

        document.querySelectorAll('.action-btn[data-action="mid"]').forEach(function(btn) {
          btn.addEventListener("click", function() {
          });
        });

        function spawnToast(text, player) {
          var toast = document.createElement('span');
          toast.className = 'flush-toast';
          toast.textContent = text;
          toast.style.color = player === 'maxx' ? '#00e5ff' : '#fc6c85';
          toast.style.textShadow = '0 0 8px ' + (player === 'maxx' ? '#007aad' : '#7a1a3a');
          document.getElementById('flush-toast-container').appendChild(toast);
          toast.addEventListener('animationend', function() { toast.remove(); });
        }

        function advanceBarFill(fillEl, skipSeconds) {
          var currentWidth = parseFloat(window.getComputedStyle(fillEl).width);
          var parentWidth = parseFloat(window.getComputedStyle(fillEl.parentElement).width);
          var elapsed = (currentWidth / parentWidth) * 30;
          var newElapsed = Math.min(30, elapsed + skipSeconds);
          fillEl.style.animation = 'none';
          fillEl.offsetHeight; // force reflow
          fillEl.style.animation = 'round-bar-reveal 30s linear forwards';
          fillEl.style.animationDelay = '-' + newElapsed + 's';
        }

        document.querySelectorAll('.action-btn[data-action="flush"]').forEach(function(btn) {
          btn.addEventListener("click", function() {
            if (btn.getAttribute("data-player") === "maxx") {
              if (round === 1) {
                countdown = Math.max(0, countdown - 1);
                countdownEl.textContent = String(countdown).padStart(2, '0');
                advanceBarFill(document.querySelector('#maxx-health ~ .round-bar .round-bar-fill'), 1);
                spawnToast('-1s FLUSH', 'maxx');
              }
            } else {
              if (round === 2) {
                countdown = Math.max(0, countdown - 1);
                countdownEl.textContent = String(countdown).padStart(2, '0');
                advanceBarFill(document.querySelector('#hammer-health ~ .round-bar .round-bar-fill'), 1);
                spawnToast('-1s FLUSH', 'hammer');
              }
            }
          });
        });

        document.querySelectorAll('.action-btn[data-action="fyre"]').forEach(function(btn) {
          btn.addEventListener("click", function() {
            var player = btn.getAttribute("data-player");
            spawnToast('+1 DMG FYRE', player);
          });
        });

        document.querySelectorAll('.action-btn[data-action="mid"]').forEach(function(btn) {
          btn.addEventListener("click", function() {
            var player = btn.getAttribute("data-player");
            spawnToast('-1 DMG MID', player);
          });
        });

        document.querySelectorAll('.action-btn[data-action="vote"]').forEach(function(btn) {
          btn.addEventListener("click", function() {
            setButtonsDisabled(true);
            // Hide vote overlay
            document.getElementById('vote-overlay').classList.remove('visible');
            // Clear any visible overlays
            document.querySelectorAll('.round-overlay').forEach(function(overlay) {
              overlay.classList.remove('visible');
            });
            
            var winnerPlayer = btn.getAttribute("data-player");
            var loserPlayer = winnerPlayer === 'maxx' ? 'hammer' : 'maxx';
            var winnerChar = winnerPlayer === 'maxx' ? maxx : hammer;
            var loserChar = loserPlayer === 'maxx' ? maxx : hammer;
            
            // Winner does Taunt, Loser does Flush (unless already Down)
            var loserCurrentAnim = loserChar.state.getCurrent(0);
            var loserIsDown = loserCurrentAnim && loserCurrentAnim.animation.name === 'Down';
            var winnerCurrentAnim = winnerChar.state.getCurrent(0);
            var winnerIsDown = winnerCurrentAnim && winnerCurrentAnim.animation.name === 'Down';
            
            if (!winnerIsDown) {
              playAnimationThenIdle(winnerChar, "Taunt", function() {});
            }
            if (!loserIsDown) {
              playAnimationOnce(loserChar, "Flush");
            }
            
            clearInterval(countdownInterval);
            (round === 1 ? audio1 : audio2).pause();
            setTimeout(function() {
              var flash = document.getElementById('flash');
              flash.style.transition = 'none';
              flash.style.opacity = 1;
              void flash.offsetWidth; // force reflow
              flash.style.transition = 'opacity 1s ease-out';
              flash.style.opacity = 0;

              if (btn.getAttribute("data-player") === "maxx") {
                switchBackground("resources/arena_p1win.webm", true);
                (new Audio('resources/winnerP1.mp3')).play().catch(function() {});
              } else {
                switchBackground("resources/arena_p2win.webm", true);
                (new Audio('resources/winnerP2.mp3')).play().catch(function() {});
              }

              var winner = btn.getAttribute("data-player");
              var winnerName = winner === 'maxx' ? 'MAXX' : 'HAMMER';

              var wo = document.getElementById('winner-overlay');
              wo.querySelector('span').textContent = winnerName + ' WINS';
              wo.classList.add('visible');
              setTimeout(function() {
                wo.classList.add('blink-out');
                setTimeout(function() {
                  wo.classList.remove('visible');
                  wo.classList.remove('blink-out');
                }, 300);
              }, 2500);
            }, 850);
          });
        });

        document.querySelectorAll('.action-btn[data-action="fyre"], .action-btn[data-action="mid"], .action-btn[data-action="flush"]').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var counter = btn.querySelector('.btn-counter');
            var count = (parseInt(counter.textContent.replace('x', '')) || 0) + 1;
            counter.textContent = 'x' + count;
            
            // Update damage modifier based on button type
            var player = btn.getAttribute('data-player');
            var action = btn.getAttribute('data-action');
            var isP1 = player === 'maxx';
            
            if (action === 'fyre') {
              // +1 per click
              if (isP1) {
                window.p1PunchDamageModifier += 1;
                window.p1PunchPlusDamageModifier += 1;
                window.p1HueModifier = (window.p1HueModifier || 0) + 1;
                window.p1BrightnessModifier = (window.p1BrightnessModifier || 0) + 1;
                window.updateHypeVideo();
              } else {
                window.p2PunchDamageModifier += 1;
                window.p2PunchPlusDamageModifier += 1;
                window.p2HueModifier = (window.p2HueModifier || 0) + 1;
                window.p2BrightnessModifier = (window.p2BrightnessModifier || 0) + 1;
                window.updateHypeVideo();
              }
            } else if (action === 'mid') {
              // -1 per click
              if (isP1) {
                window.p1PunchDamageModifier -= 1;
                window.p1PunchPlusDamageModifier -= 1;
                window.p1HueModifier = (window.p1HueModifier || 0) - 1;
                window.p1BrightnessModifier = (window.p1BrightnessModifier || 0) - 1;
                window.updateHypeVideo();
              } else {
                window.p2PunchDamageModifier -= 1;
                window.p2PunchPlusDamageModifier -= 1;
                window.p2HueModifier = (window.p2HueModifier || 0) - 1;
                window.p2BrightnessModifier = (window.p2BrightnessModifier || 0) - 1;
                window.updateHypeVideo();
              }
            }
            // flush doesn't affect damage
          });
        });

        function syncVoteWidth() {
          ['maxx', 'hammer'].forEach(function(player) {
            var btns = ['fyre', 'mid', 'flush'].map(function(action) {
              return document.querySelector('.action-btn[data-player="' + player + '"][data-action="' + action + '"]');
            });
            var voteBtn = document.querySelector('.vote-btn[data-player="' + player + '"]');
            if (btns.every(Boolean) && voteBtn) {
              var total = btns.reduce(function(sum, btn) { return sum + btn.offsetWidth; }, 0);
              var gaps = (btns.length - 1) * 8;
              voteBtn.style.width = (total + gaps) + 'px';
            }
          });
        }
        syncVoteWidth();
        window.addEventListener('resize', syncVoteWidth);
      }

      function updateRoundButtons() {
        document.querySelectorAll('.action-btn[data-player]').forEach(function(btn) {
          var player = btn.getAttribute('data-player');
          var active = round === 0
            || (round === 1 && player === 'maxx')
            || (round === 2 && player === 'hammer');
          btn.classList.toggle('inactive', !active);
        });
      }

      function createSkeleton(name, animation) {
        var atlas = assetManager.get(name + ".atlas");
        var atlasLoader = new spine.AtlasAttachmentLoader(atlas);
        var skeletonJson = new spine.SkeletonJson(atlasLoader);
        skeletonJson.scale = 1.0;

        var skeletonData = skeletonJson.readSkeletonData(assetManager.get(name + ".json"));
        var skeleton = new spine.Skeleton(skeletonData);
        skeleton.setSlotsToSetupPose();

        var stateData = new spine.AnimationStateData(skeletonData);
        var state = new spine.AnimationState(stateData);
        state.setAnimation(0, animation, true);

        return { skeleton: skeleton, state: state, data: skeletonData };
      }

      function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);

        var portrait = window.innerHeight > window.innerWidth;
        hudScale = portrait ? Math.min(1, window.innerWidth / 1160) : 1;
        charScale = portrait ? hudScale * 2 : hudScale;
        var hud = document.getElementById('hud');
        // In portrait the layout is handled by CSS; don't scale the hud
        // (a transform on #hud would break position:fixed on child buttons)
        if (!portrait && hudScale < 1) {
          hud.style.transform = 'scale(' + hudScale + ')';
          hud.style.transformOrigin = 'top center';
        } else {
          hud.style.transform = '';
          hud.style.transformOrigin = '';
        }
      }

      function render() {
        var now = Date.now() / 1000;
        var delta = now - lastFrameTime;
        lastFrameTime = now;

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        var w = canvas.width;
        var h = canvas.height;

        // Position characters on the arena floor
        var groundY = h * 0.15 + 220;

        var charSpacing = 150 * charScale;

        // Maxx on the left (facing right)
        maxx.skeleton.x = w / 2 - charSpacing;
        maxx.skeleton.y = groundY;
        maxx.skeleton.scaleX = charScale;
        maxx.skeleton.scaleY = charScale;
        maxx.state.update(delta);
        maxx.state.apply(maxx.skeleton);
        maxx.skeleton.updateWorldTransform();

        // Hammer on the right (flipped to face left)
        hammer.skeleton.x = w / 2 + charSpacing;
        hammer.skeleton.y = groundY;
        hammer.skeleton.scaleX = -charScale;
        hammer.skeleton.scaleY = charScale;
        hammer.state.update(delta);
        hammer.state.apply(hammer.skeleton);
        hammer.skeleton.updateWorldTransform();

        renderer.camera.position.x = w / 2;
        renderer.camera.position.y = h / 2;
        renderer.camera.setViewport(w, h);

        renderer.begin();
        renderer.drawSkeleton(hammer.skeleton, true);
        renderer.drawSkeleton(maxx.skeleton, true);
        renderer.end();

        if (window.updateHealthWaveforms) window.updateHealthWaveforms();

        requestAnimationFrame(render);
      }

      // Audio - use shared audio objects from audio.js
      if (window.audio1) {
        window.audio1.loop = true;
      }
      if (window.audio2) {
        window.audio2.loop = true;
      }

      function fadeOutBeat(audio, duration) {
        var steps = 40;
        var stepMs = Math.max(duration / steps, 16);
        var startVol = audio.volume;
        var step = 0;
        var iv = setInterval(function() {
          step++;
          audio.volume = Math.max(0, startVol * (1 - step / steps));
          if (step >= steps) {
            clearInterval(iv);
            audio.pause();
            audio.volume = 1;
          }
        }, stepMs);
      }

      var beat1FadeStarted = false;
      var beat2FadeStarted = false;

      // Countdown timer � two 30s rounds
      var round = 1;
      window.currentRound = 1;
      var countdown = 30;
      var countdownEl = document.getElementById('round-counter');
      var countdownInterval;

      function startBattle() {
        document.getElementById('fire-video').style.display = 'none';
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('game-canvas').style.display = '';
        document.getElementById('hud').style.display = '';
        
        setupHealthWaveforms();
        
        // Initialize hype video for Round 1
        window.initHypeVideo(1);

        // Fade out lobby music
        window.fadeLobbyMusic(3000);

        // Reset damage modifiers for new battle
        window.p1PunchDamageModifier = 0;
        window.p1PunchPlusDamageModifier = 0;
        window.p2PunchDamageModifier = 0;
        window.p2PunchPlusDamageModifier = 0;
        window.p1HueModifier = 0;
        window.p1BrightnessModifier = 0;
        window.p2HueModifier = 0;
        window.p2BrightnessModifier = 0;

        resize();
        
        window.dispatchEvent(new Event('resize'));

        var dur = window.getBeat1Duration();
        audio1.currentTime = window.getBeat1WindowPos() * (dur - 30);
        audio1.volume = 0;
        audio1.play();
        audio1.addEventListener('canplay', function fadeIn() {
          audio1.removeEventListener('canplay', fadeIn);
          var vol = 0;
          var fadeInInterval = setInterval(function() {
            if (vol < 0.7) {
              vol += 0.05;
              audio1.volume = Math.min(vol, 0.7);
            } else {
              clearInterval(fadeInInterval);
            }
          }, 100);
        });

        showRoundCaption('round1-overlay', 1000);
        startAudio.play().catch(function() {});

        // Show FIGHT at 7 seconds
        showRoundCaption('fight-overlay', 7000);

        // Build full round timeline for debug (same as menu debug)
        var atkCards = getSortedCards(window.beat1Placements);
        var atkTicks = generateTicks(atkCards);
        var defTicks = generateTicks(window.aiDefCards);
        
        // Attacker does Taunt on tick 3, then Idle on tick 4
        if (atkTicks[2]) atkTicks[2].move = 'TAUNT_DEFAULT';
        if (atkTicks[3]) atkTicks[3].move = 'IDLE';
        
        // Player 2 (defender) shouldn't act before tick 8
        for (var i = 0; i < 7 && defTicks[i]; i++) {
          if (i !== 2) defTicks[i].move = 'IDLE';
        }
        
        var combat = processCombat(atkTicks, defTicks, 1);

        // Timeline shows tick numbers matching card positions (1-30)
        var fullTimeline = [];
        for (var t = 0; t < combat.length; t++) {
          fullTimeline.push({
            atkMove: combat[t].atkMove,
            defMove: combat[t].defMove,
            atkAnim: combat[t].atkAnim,
            defAnim: combat[t].defAnim,
            atkDamage: combat[t].atkDamage,
            defDamage: combat[t].defDamage,
            tick: t + 1
          });
        }

        // Show debug panels immediately
        showDebugTimeline(fullTimeline.slice(0, 30), 1, true, false);

        // 10s intro: both players idle
        maxx.state.setAnimation(0, 'Idle', true);
        hammer.state.setAnimation(0, 'Idle', true);

        // After 10s intro, play sequences
        setTimeout(function() {
          var atkCards = getSortedCards(window.beat1Placements);
          var atkTicks = generateTicks(atkCards);
          var defTicks = generateTicks(window.aiDefCards);
          
          // Attacker does Taunt on tick 3, then Idle on tick 4
          if (atkTicks[2]) atkTicks[2].move = 'TAUNT_DEFAULT';
          if (atkTicks[3]) atkTicks[3].move = 'IDLE';
          
          // Player 2 (defender) shouldn't act before tick 8
          for (var i = 0; i < 7 && defTicks[i]; i++) {
            if (i !== 2) defTicks[i].move = 'IDLE';
          }
          
          var combat = processCombat(atkTicks, defTicks, 1);
          playCombat(maxx, hammer, combat, 1);
        }, 0);
        countdownInterval = setInterval(function() {
        countdown--;
        if (countdown <= 2 && countdown > 0) {
          if (round === 2 && !beat2FadeStarted) {
            beat2FadeStarted = true;
            audio2.volume = 0.2;
          }
        }
        if (countdown <= 0) {
          if (round === 1) {
            if (window.currentCombatInterval) clearInterval(window.currentCombatInterval);
            audio1.pause();
            audio1.volume = 1;
            var b2Start2 = window.getBeat2Start() / window.beat2Buffer.sampleRate;
            audio2.currentTime = b2Start2;
            audio2.volume = 0;
            audio2.play();
            var vol2 = 0;
            var fadeInInterval2 = setInterval(function() {
              if (vol2 < 0.7) {
                vol2 += 0.05;
                audio2.volume = Math.min(vol2, 0.7);
              } else {
                clearInterval(fadeInInterval2);
              }
            }, 100);
            round = 2;
            window.currentRound = 2;
            countdown = 30;
            countdownEl.textContent = String(countdown).padStart(2, '0');
            setHealth('maxx', 100);
            setHealth('hammer', 100);
            document.getElementById('round-label').textContent = 'ROUND 2';
            updateRoundButtons();
            showRoundCaption('round2-overlay', 0);
            
            // Reinitialize hype video for Round 2 with player2 modifier
            window.initHypeVideo(2);

            // Show FIGHT at 7 seconds into round 2
            showRoundCaption('fight-overlay', 7000);

            // Build full round timeline for debug
            var atkTicks2 = generateTicks(window.aiAtkCards);
            var defCards2 = getSortedCards(window.beat2Placements);
            var defTicks2 = generateTicks(defCards2);
            
            // Attacker does Taunt on tick 3, then Idle on tick 4 (round 2 - attacker is hammer/player2)
            if (atkTicks2[2]) atkTicks2[2].move = 'TAUNT_DEFAULT';
            if (atkTicks2[3]) atkTicks2[3].move = 'IDLE';
            
            // Player 2 (attacker in round 2) shouldn't act before tick 8
            for (var i = 0; i < 7 && atkTicks2[i]; i++) {
              if (i !== 2) atkTicks2[i].move = 'IDLE';
            }
            
            var combat2 = processCombat(atkTicks2, defTicks2, 2);
            var fullTimeline2 = [];
            for (var t = 0; t < combat2.length; t++) {
              fullTimeline2.push({
                atkMove: combat2[t].atkMove,
                defMove: combat2[t].defMove,
                atkAnim: combat2[t].atkAnim,
                defAnim: combat2[t].defAnim,
                atkDamage: combat2[t].atkDamage,
                defDamage: combat2[t].defDamage,
                tick: t + 1
              });
            }
            showDebugTimeline(fullTimeline2.slice(0, 30), 2, true, false);

            // 10s intro: both players idle
            hammer.state.setAnimation(0, 'Idle', true);
            maxx.state.setAnimation(0, 'Idle', true);

            // After 10s intro, play sequences
            setTimeout(function() {
              var atkTicks = generateTicks(window.aiAtkCards);
              var defCards = getSortedCards(window.beat2Placements);
              var defTicks = generateTicks(defCards);
              
              // Attacker does Taunt on tick 3, then Idle on tick 4 (round 2 - attacker is hammer/player2)
              if (atkTicks[2]) atkTicks[2].move = 'TAUNT_DEFAULT';
              if (atkTicks[3]) atkTicks[3].move = 'IDLE';
              
              // Player 2 (attacker in round 2) shouldn't act before tick 8
              for (var i = 0; i < 7 && atkTicks[i]; i++) {
                if (i !== 2) atkTicks[i].move = 'IDLE';
              }
              
              var combat = processCombat(atkTicks, defTicks, 2);
              playCombat(hammer, maxx, combat, 2);
            }, 0);
            var hammerFill = document.querySelector('#hammer-health ~ .round-bar .round-bar-fill');
            hammerFill.style.animation = 'round-bar-reveal 30s linear forwards';
          } else {
            // Timer fully depleted � stop audio
            audio2.pause();
            audio2.volume = 1;
            countdownEl.textContent = '00';
            clearInterval(countdownInterval);
            if (window.currentCombatInterval) clearInterval(window.currentCombatInterval);
            timersEnded = true;
            round = 0;
            updateRoundButtons();
            function getCount(player, action) {
              var el = document.querySelector('.action-btn[data-player="' + player + '"][data-action="' + action + '"] .btn-counter');
              return parseInt((el && el.textContent.replace('x', '')) || '0') || 0;
            }
            var totalFlush = getCount('maxx', 'flush') + getCount('hammer', 'flush');
            var flushBros = getCount('maxx', 'flush') >= 20 && getCount('hammer', 'flush') >= 20 && getCount('maxx', 'fyre') < 5 && getCount('hammer', 'fyre') < 5;
            if (flushBros) {
              document.getElementById('round-label').textContent = 'FLUSH BROTHERS';
              showRoundCaption('flush-brothers-overlay', 0);
              flushAudio.play().catch(function() {});
            } else {
              document.getElementById('round-label').textContent = 'VOTE NOW';
              showRoundCaption('vote-overlay', 0);
              votingAudio.play().catch(function() {});
            }
            // Show both vote buttons at end of round 2
            document.querySelectorAll('.vote-btn').forEach(function(btn) {
              btn.style.visibility = 'visible';
              btn.classList.add('vote-visible');
            });
            // Set all characters to Idle unless they're dead (DOWN animation)
            var p1Dead = maxx.state.getCurrent(0) && maxx.state.getCurrent(0).animation.name === 'Down';
            var p2Dead = hammer.state.getCurrent(0) && hammer.state.getCurrent(0).animation.name === 'Down';
            if (!p1Dead) maxx.state.setAnimation(0, 'Idle', true);
            if (!p2Dead) hammer.state.setAnimation(0, 'Idle', true);
            // Play Flush AFTER Idle for Flush Brothers (unless already Down)
            if (flushBros) {
              if (!p1Dead) setTimeout(function() { playAnimationThenIdle(maxx, 'Flush'); }, 100);
              if (!p2Dead) setTimeout(function() { playAnimationThenIdle(hammer, 'Flush'); }, 100);
            }
            // Update debug timeline to show Idle for remaining ticks
            var p1List = document.getElementById('debug-p1-list');
            var p2List = document.getElementById('debug-p2-list');
            if (p1List && p2List) {
              var p1Items = p1List.querySelectorAll('.debug-row');
              var p2Items = p2List.querySelectorAll('.debug-row');
              var currentTick = 30 - countdown;
              for (var i = currentTick; i < p1Items.length; i++) {
                p1Items[i].textContent = 'Idle(' + (i + 1) + ',Idle)';
                p2Items[i].textContent = 'Idle(' + (i + 1) + ',Idle)';
              }
            }
          }
        } else {
          countdownEl.textContent = String(countdown).padStart(2, '0');
        }
      }, 1000);

      function showRoundCaption(id, delay) {
        setTimeout(function() {
          var el = document.getElementById(id);
          el.classList.add('visible');
          setTimeout(function() {
            el.classList.add('blink-out');
            setTimeout(function() {
              el.classList.remove('visible');
              el.classList.remove('blink-out');
            }, 300);
          }, 1500);
        }, delay);
      }

      }

      window.addEventListener('DOMContentLoaded', function() {
        setupTooltips();
        document.getElementById('start-btn').addEventListener('click', function() {
          console.log('Start button clicked');
          if (window.confirmAudio) {
            confirmAudio.currentTime = 0;
            confirmAudio.play().catch(function(e) { console.error("Audio playback failed:", e); });
          }
          startBattle();
        });

        // Confirm Beat button - transitions to card placement mode
        document.getElementById('confirm-btn').addEventListener('click', function() {
          console.log('Confirm button clicked');
          if (window.confirmAudio) {
            confirmAudio.currentTime = 0;
            confirmAudio.play().catch(function(e) { console.error("Audio playback failed:", e); });
          }
          // Hide logo and full waveform
          document.getElementById('logo').style.display = 'none';
          document.getElementById('waveform-canvas').style.display = 'none';
          document.getElementById('snippet-time-display').style.display = 'none';
          document.querySelectorAll('.select-bit-label').forEach(function(el) { el.style.display = 'none'; });
          // Change label from "select a 30 second bit" to "attacking"
          // Show cards and second waveform
          document.getElementById('info-box').style.display = '';
          document.querySelectorAll('.snippet-label')[1].style.display = '';
          document.querySelectorAll('.snippet-label')[0].style.display = '';
          document.querySelectorAll('.intro-label').forEach(function(el) { el.style.display = ''; });
          document.querySelectorAll('.waveform-container')[1].style.display = '';
          document.getElementById('move-seq-2').style.display = '';
          document.getElementById('start-btn').style.display = '';
          document.getElementById('scroll-left-btn').style.display = '';
          document.getElementById('scroll-right-btn').style.display = '';
          document.getElementById('mute-btn').style.display = '';
          document.getElementById('info-toggle-btn').style.display = '';
          // Hide confirm button after clicking
          document.getElementById('confirm-btn').style.display = 'none';
          // Play lobby music
          window.playLobbyMusic();
          // Force redraw using globals
          if (window.resizeB2) window.resizeB2();
          setTimeout(function() {
            window.redrawWaveforms();
            window.redrawBeat2();
          }, 100);
        });
      });

      // Confirm Beat button - transitions to card placement mode
      document.getElementById('confirm-btn').addEventListener('click', function() {
        console.log('Confirm button clicked');
        confirmAudio.currentTime = 0;
        confirmAudio.play().catch(function(e) { console.error("Audio playback failed:", e); });
        // Hide logo and full waveform
        document.getElementById('logo').style.display = 'none';
        document.getElementById('waveform-canvas').style.display = 'none';
        document.getElementById('snippet-time-display').style.display = 'none';
        document.querySelectorAll('.select-bit-label').forEach(function(el) { el.style.display = 'none'; });
        // Change label from "select a 30 second bit" to "attacking"
        // Show cards and second waveform
        document.getElementById('info-box').style.display = '';
        document.querySelectorAll('.snippet-label')[1].style.display = '';
        document.querySelectorAll('.snippet-label')[0].style.display = '';
        document.querySelectorAll('.intro-label').forEach(function(el) { el.style.display = ''; });
        document.querySelectorAll('.waveform-container')[1].style.display = '';
        document.getElementById('move-seq-2').style.display = '';
        document.getElementById('start-btn').style.display = '';
        document.getElementById('scroll-left-btn').style.display = '';
        document.getElementById('scroll-right-btn').style.display = '';
        document.getElementById('mute-btn').style.display = '';
        document.getElementById('info-toggle-btn').style.display = '';
        // Hide confirm button after clicking
        document.getElementById('confirm-btn').style.display = 'none';
        // Play lobby music
        window.playLobbyMusic();
        // Force redraw using globals
        if (window.resizeB2) window.resizeB2();
        setTimeout(function() {
          if (window.redrawBeat2) window.redrawBeat2();
        }, 100);
      });

      // Initially hide info-box, second waveform, and start button (pre-confirm state)
      document.getElementById('info-box').style.display = 'none';
      document.querySelectorAll('.snippet-label')[1].style.display = 'none';
      document.querySelectorAll('.waveform-container')[1].style.display = 'none';
      document.getElementById('move-seq-2').style.display = 'none';
      document.getElementById('start-btn').style.display = 'none';

      document.getElementById('debug-btn').addEventListener('click', function() {
        console.log('Debug button clicked');
        var debugBoxes = document.getElementById('debug-boxes');
        var isVisible = debugBoxes.style.display !== 'none';
        
        if (isVisible) {
          debugBoxes.style.display = 'none';
          window.debugEnabled = false;
        } else {
          updateDebugTimeline();
          window.debugEnabled = true;
        }
      });

      window.p2EditorMoves = [];
      for (var i = 0; i < 30; i++) {
        window.p2EditorMoves.push({ move: 'Idle', anim: i === 0 ? 'Idle' : 'cont' });
      }

      window.renderP2Editor = function() {
        var list = document.getElementById('p2-editor-list');
        list.innerHTML = '';
        window.p2EditorMoves.forEach(function(m, idx) {
          var row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;padding:4px 4px;gap:4px;';
          
          var label = document.createElement('span');
          label.style.cssText = 'color:#888;font-size:10px;min-width:18px;';
          label.textContent = (idx + 1) + '.';
          
          var moveSelect = document.createElement('select');
          moveSelect.style.cssText = 'flex:1;font-size:10px;padding:1px;';
          moveSelect.dataset.idx = idx;
          var moves = ['Idle', 'PUNCH', 'PUNCH+', 'BLOCK', 'TAUNT', 'SUPER'];
          moves.forEach(function(mv) {
            var opt = document.createElement('option');
            opt.value = mv;
            opt.textContent = mv;
            if (mv === m.move) opt.selected = true;
            moveSelect.appendChild(opt);
          });
          moveSelect.addEventListener('change', function() {
            window.p2EditorMoves[idx].move = this.value;
            // Auto-fill default animation for the move
            var defaults = { 'Idle': 'Idle', 'PUNCH': 'Punch', 'PUNCH+': 'Punch+', 'BLOCK': 'Block', 'TAUNT': 'Idle', 'SUPER': 'Super' };
            window.p2EditorMoves[idx].anim = defaults[this.value] || 'Idle';
            window.renderP2Editor();
            updateP2EditorFromSelection();
          });
          
          var animSelect = document.createElement('select');
          animSelect.style.cssText = 'flex:1;font-size:10px;padding:1px;';
          animSelect.dataset.idx = idx;
          var anims = ['Idle', 'Punch', 'Hit', 'Parry', 'Deflect', 'Down', 'Super', 'SuperInt', 'Block', 'Punch+', 'cont'];
          anims.forEach(function(anim) {
            var opt = document.createElement('option');
            opt.value = anim;
            opt.textContent = anim;
            if (anim === m.anim) opt.selected = true;
            animSelect.appendChild(opt);
          });
          animSelect.addEventListener('change', function() {
            window.p2EditorMoves[idx].anim = this.value;
            updateP2EditorFromSelection();
          });
          
          row.appendChild(label);
          row.appendChild(moveSelect);
          row.appendChild(animSelect);
          list.appendChild(row);
        });
      };

      function updateP2EditorFromSelection() {
        window.aiDefCards = window.p2EditorMoves.map(function(m, idx) {
          return { moves: [m.move], tick: idx + 1, anim: m.anim };
        });
        if (window.debugEnabled) {
          window.updateDebugTimeline();
        }
      }

      document.getElementById('p2-edit-btn').addEventListener('click', function() {
        var editorBox = document.getElementById('p2-editor-box');
        var isVisible = editorBox.style.display !== 'none';
        
        if (isVisible) {
          editorBox.style.display = 'none';
        } else {
          window.renderP2Editor();
          editorBox.style.display = 'block';
        }
      });
      
      window.debugEnabled = false;

      window.updateDebugTimeline = function() {
        if (!window.beat1Placements || window.beat1Placements.length === 0) {
          document.getElementById('debug-boxes').style.display = 'none';
          return;
        }
        
        var atkCards = getSortedCards(window.beat1Placements);
        var atkTicks = generateTicks(atkCards);
        var defTicks = generateTicks(window.aiDefCards || []);
        var combat = processCombat(atkTicks, defTicks, 1);

        // Timeline shows tick numbers matching card positions
        var fullTimeline = [];
        for (var t = 0; t < combat.length; t++) {
          fullTimeline.push({
            atkMove: combat[t].atkMove,
            defMove: combat[t].defMove,
            atkAnim: combat[t].atkAnim,
            defAnim: combat[t].defAnim,
            atkDamage: combat[t].atkDamage,
            defDamage: combat[t].defDamage,
            tick: t + 1
          });
        }

        document.getElementById('debug-boxes').style.display = 'flex';
        showDebugTimeline(fullTimeline.slice(0, 30), 1);
      };

      init();
    })();
  

(function() {
      var audio2 = new Audio('resources/Beat2.mp3');
      var lobbyAudio = new Audio('resources/sydosys.mp3');
      var audio1Playing = false;

      audio1.addEventListener('ended', function() {
        audio1Playing = false;
        var btn = document.getElementById('play-btn-1');
        if (btn) {
          btn.querySelector('.play-icon').style.display = '';
          btn.querySelector('.pause-icon').style.display = 'none';
        }
      });
      lobbyAudio.loop = true;
      lobbyAudio.volume = 0.7;

      var audioMuted = false;

      document.getElementById('mute-btn').addEventListener('click', function() {
        audioMuted = !audioMuted;
        this.textContent = audioMuted ? '🔇' : '🔊';
        if (audioMuted) {
          lobbyAudio.volume = 0;
        } else {
          lobbyAudio.volume = 0.7;
        }
      });

      var showCardInfo = false;
      var moveDescriptions = {
        'PUNCH': 'Basic light attack. BOOSTED: Deals more damage and can\'t be blocked',
        'PUNCH+': '',
        'BLOCK': 'Instant cast. Negates light strikes, such as PUNCH',
        'SUPER': '3 second cast. Instant kill. Interrupted with PUNCH',
        'TAUNT': 'Turns upcoming PUNCH into PUNCH+',
        'CONT': 'Super continues'
      };
      
      // Card Tooltips
      var moveDescriptions = {
        'PUNCH': 'Light attack, interrupted by BLOCK. PUNCH+ Can\'t be interrupted by BLOCK',
        'PUNCH+': 'BOOSTED. Deals more damage and can\'t be blocked.',
        'BLOCK': 'Instant cast. Negates light strikes, such as PUNCH',
        'SUPER': '3 second cast. Instant kill. Interrupted with PUNCH',
        'TAUNT': 'Turns upcoming PUNCH into PUNCH+',
        'CONT': 'Super continues'
      };
      var typeDescriptions = {
        'ATTACK': 'Start this card on your BOOSTER to turn its first PUNCH into PUNCH+',
        'DEFENSE': 'Avoid opponent\'s BOOSTERS as those attacks can\'t be blocked',
        'SKILL': 'Boost upcoming moves. Can be played in both Intros and Sequences.'
      };
      // Audio Initialization
      // ... (already defined globally)

      var buttonDescriptions = {
        'fyre': 'FYRE: Show support! Hitting this will increase Player\'s attack damage',
        'mid': 'MID: Not a fan! Hitting this will reduce Player\'s attack damage',
        'flush': 'FLUSH: This hurts my ears! Hitting this speeds up the timer.'
      };

      var actionBtns = document.querySelectorAll('.action-btn');
      console.log('Found action buttons:', actionBtns.length);
      actionBtns.forEach(function(btn) {
        btn.addEventListener('pointerenter', function() {
          console.log('Pointer enter on:', this.getAttribute('data-action'));
          if (!showCardInfo) return;
          var action = this.getAttribute('data-action');
          var desc = buttonDescriptions[action];
          if (desc) {
            var infoBox = document.getElementById('drag-ghost-info');
            // Show title bigger and description below
            var title = action.toUpperCase();
            infoBox.innerHTML = '<div class="info-type ' + title + '" style="font-size:16px;">' + title + '</div>' +
                                '<div class="info-move-desc" style="margin-top:4px;">' + desc.split(': ')[1] + '</div>';
            infoBox.style.display = 'block';
            var rect = this.getBoundingClientRect();
            infoBox.style.left = (rect.left + rect.width / 2 - 100) + 'px';
            infoBox.style.top = (rect.top + rect.height + 10) + 'px';
          }
        });
        btn.addEventListener('pointerleave', function() {
          document.getElementById('drag-ghost-info').style.display = 'none';
        });
      });

      document.getElementById('info-toggle-btn').addEventListener('click', function() {
        showCardInfo = !showCardInfo;
        this.style.background = showCardInfo ? 'rgba(255,255,255,0.2)' : '';
      });
      
      function setupTooltips() {
        var buttonDescriptions = {
          'fyre': 'FYRE: Show support! Hitting this will increase Player\'s attack damage',
          'mid': 'MID: Not a fan! Hitting this will reduce Player\'s attack damage',
          'flush': 'FLUSH: This hurts my ears! Hitting this speeds up the timer.'
        };
        var actionBtns = document.querySelectorAll('.action-btn');
        console.log('Found action buttons:', actionBtns.length);
        actionBtns.forEach(function(btn) {
          btn.addEventListener('pointerenter', function() {
            console.log('Pointer enter on:', this.getAttribute('data-action'));
            if (!showCardInfo) return;
            var action = this.getAttribute('data-action');
            var desc = buttonDescriptions[action];
            if (desc) {
              var infoBox = document.getElementById('drag-ghost-info');
              // Show title bigger and description below
              var title = action.toUpperCase();
              infoBox.innerHTML = '<div class="info-type ' + title + '" style="font-size:16px;">' + title + '</div>' +
                                  '<div class="info-move-desc" style="margin-top:4px;">' + desc.split(': ')[1] + '</div>';
              infoBox.style.display = 'block';
              var rect = this.getBoundingClientRect();
              infoBox.style.left = (rect.left + rect.width / 2 - 100) + 'px';
              infoBox.style.top = (rect.top + rect.height + 10) + 'px';
            }
          });
          btn.addEventListener('pointerleave', function() {
            document.getElementById('drag-ghost-info').style.display = 'none';
          });
        });
      }

      setupTooltips();

      window.playLobbyMusic = function() {
        lobbyAudio.currentTime = 0;
        lobbyAudio.play().catch(function() {});
      };

      window.fadeLobbyMusic = function(duration) {
        var fadeInterval = setInterval(function() {
          if (lobbyAudio.volume > 0.05) {
            lobbyAudio.volume -= 0.05;
          } else {
            lobbyAudio.pause();
            lobbyAudio.volume = 0.7;
            clearInterval(fadeInterval);
          }
        }, (duration || 2000) / 20);
      };

      window.initHypeVideo = function(round) {
        var hypeVideo = document.getElementById('hype-video');
        hypeVideo.style.opacity = '0.8';
        hypeVideo.classList.remove('round2');
        // Reset position to start below screen
        hypeVideo.style.bottom = '-100vh';
        if (round === 2) {
          hypeVideo.classList.add('round2');
        }
        window.updateHypeVideo();
      };

      window.updateHypeVideo = function() {
        var hypeVideo = document.getElementById('hype-video');
        if (!hypeVideo) return;
        var currentRound = window.currentRound || 1;
        var modifier = currentRound === 1 ? (window.p1PunchDamageModifier || 0) : (window.p2PunchDamageModifier || 0);
        var percent = modifier * 5;
        if (percent > 100) percent = 100;
        var offset = -100 + percent;
        hypeVideo.style.bottom = offset + 'vh';
        hypeVideo.style.opacity = percent > 0 ? '0.8' : '0';
      };

      window.hideHypeVideo = function() {
        var hypeVideo = document.getElementById('hype-video');
        if (hypeVideo) hypeVideo.style.display = 'none';
      };

      var audio1Playing = false;

      document.getElementById('play-btn-1').addEventListener('click', function() {
        var btn = this;
        var playIcon = btn.querySelector('.play-icon');
        var pauseIcon = btn.querySelector('.pause-icon');
        
        if (audio1Playing) {
          audio1.pause();
          audio1Playing = false;
          playIcon.style.display = '';
          pauseIcon.style.display = 'none';
          var restoreInterval = setInterval(function() {
            if (!audioMuted && lobbyAudio.volume < 0.65) {
              lobbyAudio.volume += 0.05;
            } else {
              lobbyAudio.volume = audioMuted ? 0 : 0.7;
              clearInterval(restoreInterval);
            }
          }, 100);
        } else {
          audio1.pause();
          audio1.currentTime = window.getBeat1WindowPos() * (window.getBeat1Duration() - 30);
          audio1.play();
          audio1Playing = true;
          playIcon.style.display = 'none';
          pauseIcon.style.display = '';
          var fadeInterval = setInterval(function() {
            if (!audioMuted && lobbyAudio.volume > 0.05) {
              lobbyAudio.volume -= 0.05;
            } else {
              lobbyAudio.volume = audioMuted ? 0 : 0.7;
              clearInterval(fadeInterval);
            }
          }, 100);
        }
      });

      document.getElementById('play-btn-2').addEventListener('click', function() {
        audio1.pause();
        var startTime = window.getBeat2Start() / window.beat2Buffer.sampleRate;
        audio2.currentTime = startTime;
        audio2.volume = 0;
        audio2.play();
        var vol3 = 0;
        var fadeInInterval3 = setInterval(function() {
          if (vol3 < 0.7) {
            vol3 += 0.05;
            audio2.volume = Math.min(vol3, 0.7);
          } else {
            clearInterval(fadeInInterval3);
          }
        }, 100);
      });

      // AI opponent
      var allCards = [
        { name: 'Hit', type: 'ATTACK', time: 2, uptime: 1, downtime: 1, moves: ['PUNCH'] },
        { name: 'Triple Hit', type: 'ATTACK', time: 5, uptime: 3, downtime: 2, moves: ['PUNCH', 'PUNCH', 'PUNCH'] },
        { name: 'Sucker Punch', type: 'ATTACK', time: 3, uptime: 2, downtime: 1, moves: ['BLOCK', 'PUNCH'] },
        { name: 'Power Glove', type: 'ATTACK', time: 5, uptime: 3, downtime: 2, moves: ['SUPER'] },
        { name: 'Doom', type: 'ATTACK', time: 8, uptime: 5, downtime: 3, moves: ['PUNCH', 'PUNCH', 'SUPER'] },
        { name: 'Deflect', type: 'DEFENSE', time: 2, uptime: 1, downtime: 1, moves: ['BLOCK'] },
        { name: 'Turtle', type: 'DEFENSE', time: 5, uptime: 3, downtime: 2, moves: ['BLOCK', 'PUNCH', 'BLOCK'] },
        { name: 'Smartass', type: 'DEFENSE', time: 5, uptime: 3, downtime: 2, moves: ['BLOCK', 'TAUNT'] },
        { name: 'Wait For It', type: 'DEFENSE', time: 8, uptime: 5, downtime: 3, moves: ['BLOCK', 'BLOCK', 'SUPER'] },
        { name: 'Boost Morale', type: 'SKILL', time: 3, uptime: 2, downtime: 1, moves: ['TAUNT'] }
      ];

      function scoreAttackSequence(cards) {
        var moves = [];
        cards.forEach(function(c) { c.moves.forEach(function(m) { moves.push(m); }); });
        var score = 0;
        for (var i = 0; i < moves.length; i++) {
          if (moves[i] === 'SUPER') score += 3;
          if (moves[i] === 'PUNCH') {
            if (i > 0 && moves[i - 1] === 'TAUNT') score += 2;
            else score += 0.5;
          }
          if (moves[i] === 'TAUNT' && i < moves.length - 1 && moves[i + 1] === 'PUNCH') score += 1;
        }
        return score;
      }

      function scoreDefendSequence(cards) {
        var moves = [];
        cards.forEach(function(c) { c.moves.forEach(function(m) { moves.push(m); }); });
        var score = 0;
        moves.forEach(function(m) {
          if (m === 'BLOCK') score += 2;
          if (m === 'SUPER') score += 1;
        });
        return score;
      }

      function generateSequence(pool, scorer) {
        var best = [];
        for (var attempt = 0; attempt < 200; attempt++) {
          var shuffled = pool.slice().sort(function() { return Math.random() - 0.5; });
          var picked = [];
          var used = 30;
          for (var i = 0; i < shuffled.length && used > 0; i++) {
            if (shuffled[i].time <= used) {
              picked.push(shuffled[i]);
              used -= shuffled[i].time;
            }
          }
          if (scorer(picked) > scorer(best)) best = picked;
        }
        return best;
      }

      function generateAttacking() {
        var attackPool = allCards.filter(function(c) { return c.type === 'ATTACK' || c.type === 'SKILL'; });
        return generateSequence(attackPool, scoreAttackSequence);
      }

      function generateDefending() {
        var defendPool = allCards.filter(function(c) { return c.type === 'DEFENSE'; });
        return generateSequence(defendPool, scoreDefendSequence);
      }

      function processMoves(cards) {
        var moves = [];
        cards.forEach(function(c) { c.moves.forEach(function(m) { moves.push(m); }); });
        return moves;
      }

      var aiAtk = generateAttacking();
      var aiDef = generateDefending();

      // Add pos values to AI cards - start from tick 8 (index 7)
      var aiAtkPos = 7;
      aiAtk.forEach(function(c) { c.tick = aiAtkPos; aiAtkPos += c.time; });
      var aiDefPos = 7;
      aiDef.forEach(function(c) { c.tick = aiDefPos; aiDefPos += c.time; });

      var hitCards = [];
      // First 7 ticks are Idle
      for (var k = 0; k < 7; k++) {
        hitCards.push({ name: 'Idle', type: 'DEFENSE', time: 1, uptime: 0, downtime: 1, moves: ['Idle'], tick: k + 1 });
      }
      // Remaining ticks are Hit
      for (var i = 0; i < 14; i++) {
        hitCards.push({ name: 'Hit', type: 'ATTACK', time: 2, uptime: 1, downtime: 1, moves: ['PUNCH'], tick: (i + 7) * 2 + 1 });
      }

      var idleCards = [];
      // First 7 ticks are Idle for both
      for (var j = 0; j < 7; j++) {
        idleCards.push({ name: 'Idle', type: 'DEFENSE', time: 1, uptime: 0, downtime: 1, moves: ['Idle'], tick: j + 1 });
      }
      // Start actual idles from tick 8
      for (var k = 7; k < 30; k++) {
        idleCards.push({ name: 'Idle', type: 'DEFENSE', time: 1, uptime: 0, downtime: 1, moves: ['Idle'], tick: k + 1 });
      }
      window.idleAtkCards = idleCards.slice();
      window.idleDefCards = idleCards.slice();
      window.aiAtkCards = idleAtkCards.slice();
      window.aiDefCards = idleDefCards.slice();

      var hitBtn = document.getElementById('ai-mode-btn');
      var aiBtn = document.getElementById('ai-popup-btn');
      var idleBtn = document.getElementById('idle-mode-btn');
      var aiMode = 1; // 0 = HIT, 1 = AI, 2 = IDLE

      function updateMode() {
        hitBtn.classList.toggle('mode-on', aiMode === 0);
        aiBtn.classList.toggle('mode-on', aiMode === 1);
        idleBtn.classList.toggle('mode-on', aiMode === 2);
        if (aiMode === 1) {
          window.aiAtkCards = aiAtk.slice();
          window.aiDefCards = aiDef.slice();
        } else if (aiMode === 2) {
          window.aiAtkCards = idleAtkCards.slice();
          window.aiDefCards = idleDefCards.slice();
        } else {
          window.aiAtkCards = hitCards.slice();
          window.aiDefCards = hitCards.slice();
        }
        if (window.debugEnabled) window.updateDebugTimeline();
      }

      hitBtn.addEventListener('click', function() {
        aiMode = 0;
        updateMode();
      });
      aiBtn.addEventListener('click', function() {
        aiMode = 1;
        updateMode();
      });
      idleBtn.addEventListener('click', function() {
        aiMode = 2;
        updateMode();
      });
      
      // Show/hide AI buttons with backtick key
      document.addEventListener('keydown', function(e) {
        if (e.key === '`') {
          var btns = document.querySelectorAll('#ai-mode-btn, #ai-popup-btn, #idle-mode-btn, #debug-btn, #p2-edit-btn');
          btns.forEach(function(btn) {
            btn.style.display = btn.style.display === 'none' ? '' : 'none';
          });
        }
      });
      updateMode();

      init();
    })();

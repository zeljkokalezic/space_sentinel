export const EVENTS_DATA = [
  {
    id: "derelict_freighter",
    title: "Derelict Freighter",
    text: "You stumble across a derelict freighter drifting silently in the void. Its cargo bays appear intact, but erratic energy signatures suggest an unstable core.",
    choices: [
      {
        text: "Scavenge the cargo bays (Gain 50 Scrap, 30% chance to take 30 DMG)",
        resolve: (gameRef) => {
           if (Math.random() < 0.3) gameRef.current.player.hp -= 30;
           gameRef.current.scrap += 50;
        }
      },
      {
         text: "Extract the core (Lose 20% current HP, Gain 25 Max HP)",
         resolve: (gameRef) => {
            gameRef.current.player.hp -= Math.floor(gameRef.current.player.hp * 0.2);
            gameRef.current.player.maxHp += 25;
            gameRef.current.player.hp += 25; 
         }
      },
      { text: "Leave it alone", resolve: () => {} }
    ]
  },
  {
    id: "temporal_anomaly",
    title: "Temporal Anomaly",
    text: "A shimmering tear in spacetime blocks your path. Scanners indicate that passing through might fundamentally alter your ship's momentum engines at the cost of structural integrity.",
    choices: [
      {
        text: "Fly into the rift (Gain +20 Speed, Lose 20 Max HP)",
        resolve: (gameRef) => {
            gameRef.current.player.speed += 20;
            gameRef.current.player.maxHp -= 20;
            if (gameRef.current.player.hp > gameRef.current.player.maxHp) gameRef.current.player.hp = gameRef.current.player.maxHp;
        }
      },
      {
        text: "Harvest anomaly particles (Gain 100 Scrap, 50% chance to lose 50 HP)",
        resolve: (gameRef) => {
            gameRef.current.scrap += 100;
            if (Math.random() < 0.5) gameRef.current.player.hp -= 50;
        }
      },
      { text: "Chart a safe course around it", resolve: () => {} }
    ]
  },
  {
    id: "space_pirates",
    title: "Pirate Ambush",
    text: "A hidden fleet of scavenger pirates drops their cloaking devices! 'Pay the toll or become space dust, Sentinel!' the captain broadcasts over comms.",
    choices: [
      {
        text: "Pay the toll (Lose 75 Scrap)",
        condition: (gameRef) => gameRef.current.scrap >= 75,
        resolve: (gameRef) => {
           gameRef.current.scrap -= 75;
        }
      },
      {
        text: "Ram their flagship! (Take 40 DMG, Gain 40 Scrap)",
        resolve: (gameRef) => {
           gameRef.current.player.hp -= 40;
           gameRef.current.scrap += 40;
        }
      }
    ]
  },
  {
    id: "ancient_monolith",
    title: "Ancient Monolith",
    text: "A monolithic black structure floats in empty space. A telepathic hum echoes in your mind, offering power in exchange for your vitality.",
    choices: [
      {
        text: "Offer vitality (Take 30 DMG, Upgrade Autocannon level +1)",
        resolve: (gameRef) => {
           gameRef.current.player.hp -= 30;
           gameRef.current.levels.autocannon = Math.min(20, gameRef.current.levels.autocannon + 1);
        }
      },
      {
        text: "Resist the monolith (Gain 10 Max HP)",
        resolve: (gameRef) => {
           gameRef.current.player.maxHp += 10;
           gameRef.current.player.hp += 10;
        }
      }
    ]
  },
  {
    id: "distress_beacon",
    title: "Distress Beacon",
    text: "You intercept an audio transmission: a transport vessel is under attack. However, it's deep inside an intense cosmic radiation belt.",
    choices: [
      {
        text: "Rush to help (Take 25 DMG, Gain 80 Scrap)",
        resolve: (gameRef) => {
           gameRef.current.player.hp -= 25;
           gameRef.current.scrap += 80;
        }
      },
      { text: "Ignore the signal", resolve: () => {} }
    ]
  },
  {
    id: "black_market",
    title: "Black Market Outpost",
    text: "You discover a secluded asteroid base dealing in illicit technologies. They offer an experimental hull plating exchange.",
    choices: [
      {
        text: "Trade mobility for armor (Lose 15 Speed, Gain 40 Max HP)",
        resolve: (gameRef) => {
           gameRef.current.player.speed = Math.max(100, gameRef.current.player.speed - 15);
           gameRef.current.player.maxHp += 40;
           gameRef.current.player.hp += 40;
        }
      },
      {
        text: "Buy black market scrap caches (Pay 50 Max HP, Gain 150 Scrap)",
        resolve: (gameRef) => {
           gameRef.current.player.maxHp -= 50;
           if (gameRef.current.player.hp > gameRef.current.player.maxHp) gameRef.current.player.hp = gameRef.current.player.maxHp;
           gameRef.current.scrap += 150;
        }
      },
      { text: "Leave quietly", resolve: () => {} }
    ]
  },
  {
    id: "sentient_nebula",
    title: "Sentient Nebula",
    text: "As you fly through a vibrant pink nebula, it actively attempts to interface with your ship's targeting AI.",
    choices: [
      {
        text: "Allow the interface (Upgrade Auto-Aim)",
        condition: (gameRef) => gameRef.current.levels.autoAim < 1,
        resolve: (gameRef) => {
           gameRef.current.levels.autoAim = 1;
        }
      },
      {
        text: "Purge the geometric intrusion (Take 15 DMG, Gain 20 Scrap)",
        resolve: (gameRef) => {
           gameRef.current.player.hp -= 15;
           gameRef.current.scrap += 20;
        }
      }
    ]
  },
  {
    id: "smugglers_cache",
    title: "Smuggler's Cache",
    text: "Tucked inside a hollowed-out asteroid is an abandoned smuggler's stash. Scanners indicate it is heavily mined.",
    choices: [
      {
        text: "Carefully disarm the mines (Gain 120 Scrap, 60% chance for 40 DMG)",
        resolve: (gameRef) => {
           gameRef.current.scrap += 120;
           if (Math.random() < 0.6) gameRef.current.player.hp -= 40;
        }
      },
      { text: "It's too risky. Leave.", resolve: () => {} }
    ]
  },
  {
    id: "abandoned_station",
    title: "Abandoned Station",
    text: "A heavily damaged defensive station drifts aimlessly. Its automated repair bays are functional but require raw scrap input.",
    choices: [
      {
        text: "Pay 50 Scrap to repair 50% of your missing HP",
        condition: (gameRef) => gameRef.current.scrap >= 50,
        resolve: (gameRef) => {
           gameRef.current.scrap -= 50;
           let missing = gameRef.current.player.maxHp - gameRef.current.player.hp;
           gameRef.current.player.hp += Math.floor(missing * 0.5);
        }
      },
      {
        text: "Strip the station for parts (Gain 40 Scrap)",
        resolve: (gameRef) => {
           gameRef.current.scrap += 40;
        }
      }
    ]
  },
  {
    id: "magnetic_storm",
    title: "Magnetic Storm",
    text: "A violent magnetic storm threatens to scramble your ship's systems. You can either power through it or harness its energy to calibrate your scrap magnets.",
    choices: [
      {
        text: "Harness the energy (Upgrade Magnet level +1, Take 25 DMG)",
        resolve: (gameRef) => {
           gameRef.current.levels.magnet = Math.min(10, gameRef.current.levels.magnet + 1);
           gameRef.current.player.hp -= 25;
        }
      },
      {
        text: "Evade the storm (Lose 20 Scrap during maneuvers)",
        resolve: (gameRef) => {
           gameRef.current.scrap = Math.max(0, gameRef.current.scrap - 20);
        }
      }
    ]
  }
];

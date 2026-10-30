import type { CustomCatalogueEntry } from './types';

export const HUJIN_NOTHIC_PRIME_ID = 'hujin-nothic-prime';

export function createHujinNothicPrime(timestamp = new Date().toISOString()): CustomCatalogueEntry {
  return {
    id: HUJIN_NOTHIC_PRIME_ID,
    category: 'monster',
    name: "Hujin'Nothic Prime",
    description: "The most accomplished of Hujin Juunat's surviving clones and simulacra. Driven mad by its search for arcane knowledge, Prime has sealed itself within Hujin's Contingency. It studies intruders' thoughts before turning on them. Its wild motes draw power from the four Orbs of Order: Creation, Anchorage, Persistence, and Destruction.",
    source: 'Custom',
    ruleset: 'Homebrewry',
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    data: {
      size: 'M',
      type: 'aberration',
      alignment: 'NE',
      ac: '16',
      hp: '145 (17d8 + 68)',
      speed: '30 ft.',
      cr: '7',
      abilities: { str: 14, dex: 16, con: 18, int: 20, wis: 16, cha: 12 },
      savingThrows: { con: 7, int: 8, wis: 6 },
      skills: { arcana: 11, insight: 9, perception: 9, stealth: 6 },
      damageResistances: ['Necrotic', 'Psychic'],
      senses: { truesight: 120 },
      passivePerception: 19,
      languages: ['Common', 'Undercommon', 'telepathy 120 ft.'],
      traits: [
        { name: 'Legendary Resistance', usage: '3/Day', text: 'If Prime fails a saving throw, it can choose to succeed instead.' },
        { name: 'Magic Resistance', text: 'Prime has Advantage on saving throws against spells and other magical effects.' },
        { name: 'Innate Spellcasting', text: 'Intelligence (spell save DC 16, +8 to hit); no material components. At will: Detect Magic, Detect Thoughts, Mage Hand. 3/day each: Invisibility, Misty Step, Counterspell. 1/day each: Greater Invisibility, Dimension Door.' },
        { name: 'Orbs of Order', text: 'Prime manipulates only one of the four orbs at a time while within 120 ft. of the Contingency. The other three are enclosed in spheres of Wall of Force. Switching orbs immediately seals the previously exposed orb.' }
      ],
      actions: [
        { name: 'Multiattack', text: 'Prime makes two Claw attacks.' },
        { name: 'Claw', text: 'Melee Attack Roll: +7, reach 5 ft. Hit: 13 (2d8 + 4) Slashing damage.' },
        { name: 'Mind Fracture', usage: 'Recharge 5-6', text: 'Up to three creatures within 60 ft. make a DC 16 Intelligence saving throw. Failure: 18 (4d8) Psychic damage, and the target cannot take Reactions until the start of Prime’s next turn. Success: Half damage only.' },
        { name: 'Call the Failed', usage: '2/Day', text: 'Prime summons two Nothics into unoccupied spaces within 60 ft., up to four total. They act immediately after Prime in Initiative and disappear when killed.' }
      ],
      bonusActions: [
        { name: 'Wild Moting — Creation', text: 'Prime exposes the Orb of Creation. A 10-ft.-radius sphere within 90 ft. erupts: DC 16 Dexterity save, 18 (4d8) Force damage, half on success. Alternatively, Prime creates a solid 10-ft. cube in an unoccupied space for 1 minute.' },
        { name: 'Wild Moting — Anchorage', text: 'Prime exposes the Orb of Anchorage. One target within 60 ft. makes a DC 16 Strength save. On failure, its Speed is 0 and it cannot teleport or be moved until the end of its next turn.' },
        { name: 'Wild Moting — Destruction', text: 'Prime exposes the Orb of Destruction. One target within 90 ft. makes a DC 16 Constitution save, taking 18 (4d8) Force damage, half on success. Alternatively, Prime uses Dispel Magic (3rd level) within 60 ft.' }
      ],
      reactions: [
        { name: 'Persistence — Mote of Continuance', text: 'When a spell or condition within 60 ft. would end, Prime exposes the Orb of Persistence and sustains that effect until the end of Prime’s next turn without requiring Concentration. The effect remains dispellable. Switching orbs ends this persistence.' }
      ],
      legendaryActions: [
        { name: 'Legendary Actions', text: 'Prime can take 2 Legendary Actions per round, one at the end of another creature’s turn; uses refresh at the start of its turn.' },
        { name: 'Skitter', text: 'Prime moves up to half its Speed without provoking Opportunity Attacks.' },
        { name: 'Psychic Whisper', text: 'One creature Prime can sense within 60 ft. makes a DC 16 Wisdom save, taking 9 (2d8) Psychic damage on a failure, or half on a success.' },
        { name: 'Weird Insight', text: 'One creature Prime can see within 120 ft. makes a DC 16 Wisdom save. On failure, Prime learns one secret or fact about it.' }
      ],
      orbInteraction: 'A creature adjacent to the exposed orb can use an action and make a DC 16 Intelligence (Arcana) check. Success: suppress the orb for one round or redirect its mote. Failure by 5 or more: take 7 (2d6) Force damage.'
    }
  };
}

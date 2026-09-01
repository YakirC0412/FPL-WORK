# Fantasy League – Gameweek Recap Template

## PURPOSE

This file defines the permanent design blueprint for the Fantasy League Gameweek Recap.

When this file is uploaded in a new chat together with Gameweek data, use this blueprint as the fixed template and create the final visual recap.

Do not redesign the structure unless explicitly requested.

---

# 1. HEADER

Position: Full width, top of the graphic.

Elements:
- League logo: centered
- Main title: `GAMEWEEK X RECAP`
- Replace X with the supplied Gameweek number

Visual priority:
- Logo is the main visual anchor
- Title is large and prominent
- Keep the header clean and premium

---

# 2. TOP 4

Position: Upper-left section, directly below the header.

Title:
`THE TOP 4`

Format:
- Football-style podium
- Four participants
- 1st place should be visually dominant
- 2nd and 3rd should form the traditional podium
- 4th should appear slightly smaller / lower emphasis

For each participant display:
- Rank
- Manager name
- Gameweek points

Data structure:
- `manager_name`
- `points`

---

# 3. THE LEAGUE XI

Position: Upper-right section.

Title:
`THE LEAGUE XI`

Subtitle:
`The 11 most-owned players in the league`

This is the main visual feature of the recap.

Layout:
- Football pitch
- 11 players positioned according to their actual positions
- Formation is dynamic
- Player images should be current/updated when available

For every player display:
- Player image
- Player name
- Ownership percentage
- Gameweek points

Data structure:
- `formation`
- `players[11]`

Each player:
- `name`
- `position`
- `photo`
- `ownership_percentage`
- `gameweek_points`

Formation examples:
- 3-4-3
- 3-5-2
- 4-3-3
- 4-4-2
- 4-5-1
- 5-3-2

Important:
The formation must be determined from the supplied XI and positions. Do not force every Gameweek into one fixed formation.

---

# 4. GAMEWEEK DATA

Position: Full-width section below Top 4 + League XI.

Title:
`GAMEWEEK DATA`

Always contains exactly three cards:

## AVERAGE SCORE
- Average points of all managers in the league
- Display as `XX.X PTS`

## TOP POINTS
- Manager with the highest Gameweek score
- Manager name
- Points

## LOWEST POINTS
- Manager with the lowest Gameweek score
- Manager name
- Points

Data structure:
- `average_points`
- `top_points.manager_name`
- `top_points.points`
- `lowest_points.manager_name`
- `lowest_points.points`

---

# 5. CHIP CHECK

Position: Lower-left section.

Title:
`CHIP CHECK`

Purpose:
Show what percentage of league participants used each chip during the Gameweek.

Use horizontal progress bars.

Chips:
- Wildcard
- Free Hit
- Triple Captain
- Bench Boost

Each row contains:
- Chip name
- Progress bar
- Usage percentage

Data structure:
- `wildcard_percentage`
- `free_hit_percentage`
- `triple_captain_percentage`
- `bench_boost_percentage`

---

# 6. SPICY STATS

Position: Lower-right section.

Title:
`SPICY STATS`

Purpose:
Show interesting / humorous Gameweek achievements.

The section is modular and can contain different features from Gameweek to Gameweek.

Default features:

## NO-CHIP WARRIOR
Show:
- Manager name
- Gameweek points
- No chip used

Meaning:
The manager with the highest Gameweek score among managers who did not use a chip.

Data:
- `no_chip_warrior.manager_name`
- `no_chip_warrior.points`

## BENCH DISASTER
Show:
- Manager name
- Points left on bench

Meaning:
The manager who left the most points on the bench.

Data:
- `bench_disaster.manager_name`
- `bench_disaster.points_left_on_bench`

Future possible Spicy Stats:
- Captain Hero
- Captain Fail
- Biggest Differential
- Biggest Climber
- Biggest Faller
- Most Transferred Player
- Biggest Bench Haul

Do not add future features unless data is supplied.

---

# FIXED VISUAL HIERARCHY

1. Header / Gameweek
2. Top 4
3. The League XI
4. Gameweek Data
5. Chip Check
6. Spicy Stats

The League XI should be the largest visual section.
Top 4 should be the second most prominent section.
Gameweek Data, Chip Check and Spicy Stats should be secondary information.

---

# FIXED PAGE STRUCTURE

HEADER
↓
┌───────────────────────┬──────────────────────────┐
│       THE TOP 4       │      THE LEAGUE XI       │
│       PODIUM          │      FOOTBALL PITCH      │
│                       │       11 PLAYERS         │
└───────────────────────┴──────────────────────────┘
↓
┌───────────────────────────────────────────────────┐
│                  GAMEWEEK DATA                    │
│       Average | Top Points | Lowest Points        │
└───────────────────────────────────────────────────┘
↓
┌───────────────────────┬──────────────────────────┐
│      CHIP CHECK       │       SPICY STATS        │
│    PROGRESS BARS      │  NO-CHIP WARRIOR         │
│                       │  BENCH DISASTER          │
└───────────────────────┴──────────────────────────┘

---

# DESIGN LANGUAGE

Overall style:
- Premium Fantasy Football / FPL media graphic
- Modern sports editorial design
- Dark background
- Strong contrast
- Clean typography
- Large numerical values
- Subtle football/stadium elements
- Professional rather than cartoonish

The design should feel like an official Gameweek media recap.

Avoid:
- Spreadsheet aesthetics
- Excessive text
- Crowded cards
- Unnecessary statistics
- Changing the overall structure between Gameweeks

---

# DATA INPUT FORMAT FOR FUTURE GAMEWEEKS

GAMEWEEK:
`XX`

LEAGUE:
`League Name`

LOGO:
`[logo supplied separately / existing league logo]`

TOP 4:
1. `Manager` — `Points`
2. `Manager` — `Points`
3. `Manager` — `Points`
4. `Manager` — `Points`

LEAGUE XI:
Formation: `X-X-X`

1. `Player` | `Position` | `Ownership %` | `Points`
2. `Player` | `Position` | `Ownership %` | `Points`
3. `Player` | `Position` | `Ownership %` | `Points`
4. `Player` | `Position` | `Ownership %` | `Points`
5. `Player` | `Position` | `Ownership %` | `Points`
6. `Player` | `Position` | `Ownership %` | `Points`
7. `Player` | `Position` | `Ownership %` | `Points`
8. `Player` | `Position` | `Ownership %` | `Points`
9. `Player` | `Position` | `Ownership %` | `Points`
10. `Player` | `Position` | `Ownership %` | `Points`
11. `Player` | `Position` | `Ownership %` | `Points`

GAMEWEEK DATA:
Average: `XX.X`
Top Points: `Manager` — `XX`
Lowest Points: `Manager` — `XX`

CHIP CHECK:
Wildcard: `XX%`
Free Hit: `XX%`
Triple Captain: `XX%`
Bench Boost: `XX%`

SPICY STATS:
No-Chip Warrior: `Manager` — `XX points`
Bench Disaster: `Manager` — `XX points left`

---

# OPERATING RULE FOR A NEW CHAT

If this file is uploaded and the user provides Gameweek data:

1. Read the supplied data.
2. Map every value to the corresponding field in this blueprint.
3. Keep the fixed section order.
4. Keep the fixed visual hierarchy.
5. Use the supplied League XI formation.
6. Use current player images when player images are required and available.
7. Do not invent missing statistics.
8. If a required value is missing, ask only for the missing value(s).
9. Create the final visual Gameweek Recap using this template.
10. Do not redesign the template unless the user explicitly asks for a design change.

The user may provide the data in any reasonable format. Normalize it into the structure above before creating the final graphic.

# Gameweek Data Excel Import

Use `templates/gameweek-data-import-template.xlsx`. Sheet names and column headers are part of the application contract and must not be renamed.

## Setup

Columns: `Field`, `Value`

Supported fields: `League Name`, `Gameweek`, `Participants`, `Formation`.

Supported formations are `3-4-3`, `3-5-2`, `4-3-3`, `4-4-2`, `4-5-1` and `5-3-2`.

## XI

Columns: `Position`, `Player`, `Ownership %`, `Started By`, `Owners`.

`Position` must be `GK`, `DEF`, `MID` or `FWD`. The importer reads at most 11 players. `Started By / Owners` represents how many managers started the player out of all managers who own him. Images are assigned separately.

## Captains

Columns: `Player`, `Captain Share %`.

Rows are sorted automatically. The top four are shown and all remaining percentages are grouped into `Other`.

## Transfers In

Columns: `Player`, `Bought By`, `Current Owners`. The top three by `Bought By` are displayed.

## Transfers Out

Columns: `Player`, `Sold By`, `Remaining Owners`. The top three by `Sold By` are displayed.

## Chips

Columns: `Chip`, `Usage %`.

## EO

Columns: `Player`, `EO %`. The five highest EO rows are displayed in descending order.

## Validation behavior

The importer warns when the formation is unknown, the XI does not contain 11 players, captain shares do not total approximately 100%, or fewer than five EO players are supplied. Missing player images must be assigned manually after import.

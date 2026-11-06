# Google Sheets schema

The new application expects these exact tab names and column order. Confirm the actual live workbook before launch.

## Inventory

| Column | Header | Used for |
|---|---|---|
| A | ID | Unique shoe identifier |
| B | Picture | Google Drive thumbnail URL created by the admin photo uploader |
| C | Buying Price | Internal purchase cost |
| D | size | Shoe size |
| E | Target Price | Public asking price |
| F | Status | Available, Reserved, or Sold |
| G | method Payment | Payment method |
| H | price sold | Final selling price |
| I | Profit Margin | Margin fraction |
| J | comment | Internal note |
| K | Date | Sale date / date field |
| L | Category | Product category |
| M | Stock Type | Batch number |
| N | Hot Sale | `TRUE` or `FALSE` promotional badge |
| O | Sale Price | Optional promotional selling price |
| P | Reserved Date | Timestamp when the item was marked Reserved |

## Orders

`Order ID`, `Shoe ID`, `Customer Name`, `Phone`, `Location`, `Comment`, `Date`, `Status`

## Admins

| Column | Header | Used for |
|---|---|---|
| A | Username | Login name (morisky, mon, kamala) |
| B | PasswordHash | Legacy SHA-256 hash (64 hex characters); automatically upgraded to scrypt (128 hex characters) after a successful login |
| C | Salt | Unique random salt for that administrator |
| D | Role | `Super Admin` or `Admin` |
| E | Active | `TRUE` or `FALSE` |

Run `npm run admins:setup` once to replace the legacy `Email` / `Password` columns. The script asks for new passwords and writes only hashes and salts. Do not store plain-text passwords in this tab.

## History

`Timestamp`, `Shoe ID`, `Field Changed`, `Old Value`, `New Value`, `Changed By`, `Full Row Snapshot`, `Action`

The current Next.js migration does not yet write a full history trail. Keep the existing tab intact; do not delete historical data.

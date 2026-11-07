# Google Sheets schema

The application reads these headers by name and can append the `Pending Amount` column if it is missing. Keep the existing tabs and historical rows; do not run setup scripts against a live workbook.

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
| Q | Pending Amount | Outstanding customer balance in KSh; zero when fully paid |

## Orders

`Order ID`, `Shoe ID`, `Customer Name`, `Phone`, `Location`, `Comment`, `Date`, `Status` (booking API joins Shoe ID to Inventory to show the photo/category/size)

## Admins

| Column | Header | Used for |
|---|---|---|
| A | Username | Login name (morisky, mon, kamala) |
| B | PasswordHash | Legacy SHA-256 hash (64 hex characters); automatically upgraded to scrypt (128 hex characters) after a successful login |
| C | Salt | Unique random salt for that administrator |
| D | Role | `Super Admin` or `Admin` |
| E | Active | `TRUE` or `FALSE` |
| F | mail | Administrator email address for new-order notifications |

Do not rerun the admin setup script on the live workbook. Keep each active administrator email in the `mail` column; new admin accounts should be created through the Super Admin screen with an email address.

## History

`Timestamp`, `Shoe ID`, `Field Changed`, `Old Value`, `New Value`, `Changed By`, `Full Row Snapshot`, `Action`

The current Next.js migration does not yet write a full history trail. Keep the existing tab intact; do not delete historical data.

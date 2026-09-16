# Costbase

## Description

Costbase tracks Australian share portfolios for tax. It keeps every parcel with its
cost base and acquisition date, and produces the reports you need at tax time: realised
capital gains split short- and long-term, capital losses, the 50% CGT discount, and
unrealised gains by FIFO tax lot.

A few standalone calculators come along for the ride — income tax, savings/FIRE, and a
budget planner.

Personal project, actively worked on.

## Technologies

- SvelteKit
- Svelte 5
- TypeScript
- Tailwind CSS
- Drizzle ORM + PostgreSQL
- Better Auth
- LayerChart

## Development

```sh
npm install
npm run dev
```

Requires `DATABASE_URL` in `.env` pointing at a PostgreSQL database.

| Command             | Does                                    |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Start the dev server                    |
| `npm run check`     | Type-check with `svelte-check`          |
| `npm run lint`      | Prettier check + ESLint                 |
| `npm run format`    | Apply Prettier                          |
| `npm test`          | Run the unit tests                      |
| `npm run db:push`   | Push the Drizzle schema to the database |
| `npm run db:studio` | Open Drizzle Studio                     |

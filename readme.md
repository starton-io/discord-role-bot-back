
# Starton Discord Role bot

This bot allows you to give role when user own tokens (ERC20) or NFTs (ERC721 / ERC1155).

# Requirements
## Discord
A Discord Developper Account.
You can apply here: [discord developer portal](https://discord.com/developers/)

## Starton
A Starton account.
Then you can get your API key [here](https://app.starton.io/api)


# Use the bot

# Run the bot
## Install

```bash
git clone https://github.com/starton-io/discord-role-bot-back
cd discord-role-bot-back
```

## Start in dev
```bash
Create a .env from the .env.example
Create the "uuid-ossp" extension in database if needed (CREATE EXTENSION IF NOT EXISTS "uuid-ossp";)
yarn dev #(or npm run dev)
```

## Bot front
You need a front part so that the user can sign the message to verify his address.  
But don't worry, you can find it [here](https://github.com/starton-io/discord-role-bot-front)


# Extending the bot
This bot use the [discors.js](https://github.com/oceanroleplay/discord.ts) package.

You can find the full documentation on their website: https://discord-ts.js.org/

## Authors

- [@cervantescedric - CTO @starton.io](https://linkedin.com/in/cedriccervantes/)


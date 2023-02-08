
# Starton Discord Role bot

This bot allows you to give role when user own tokens (ERC20) or NFTs (ERC721 / ERC1155).

# Readme in progress, not yet ready without onboarding

# Requirements
## Discord
You need to have a Discord Developper Account.
You can apply here: [discord developer portal](https://discord.com/developers/)

When you have your credentials you need to set them in a `.env` file

- `BOT_TOKEN=`



## Starton Connect
You need to have a Starton Connect account.
You can create a free account [here](https://connect.starton.io)

You can create an API key in the `Developer` section.


# Start the bot
## Install

```bash
git clone https://github.com/starton-io/discord-role-bot-back
cd discord-role-bot-back
```

## Start in dev:
```bash
yarn dev #(or npm run dev)
```

## Start in production:
```bash
yarn build && yarn start #(or npm run build && npm start)
```

## Extending the bot
This bot use the amazing https://github.com/oceanroleplay/discord.ts package.

You can find the full documentation on their website: https://discord-ts.js.org/

## Authors

- [@cervantescedric - CTO @starton.io](https://linkedin.com/in/cedriccervantes/)

## Use directly
https://discord.com/api/oauth2/authorize?client_id=919408561992376331&permissions=2415921152&scope=applications.commands%20bot

#test

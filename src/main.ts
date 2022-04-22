import express, { Request, Response } from "express"
import { Link } from "./entity/link.entity"
import { ethers } from "ethers"
import { createConnection, getConnection, Transaction } from "typeorm"
import { Discord } from "./discord"
import { Starton } from "./starton"
import { Contract } from "./entity/contract.entity"
import { Member } from "./entity/member.entity"
import { join } from "path"
import { createHmac } from "crypto"
import { Trigger } from "./entity/trigger.entity"

const cors = require("cors")
require("dotenv").config()

const app = express()
app.use(express.json())
app.use(cors())

createConnection({
	type: "postgres",
	host: process.env.TYPEORM_HOST as string,
	port: parseInt(process.env.TYPEORM_PORT as string),
	username: process.env.TYPEORM_USERNAME as string,
	password: process.env.TYPEORM_PASSWORD as string,
	database: process.env.TYPEORM_DATABASE as string,
	synchronize: true,
	entities: [join(__dirname, "**", "*.entity.{ts,js}")],
	migrations: ["src/migration/**/*.ts"],
	subscribers: ["src/subscriber/**/*.ts"],
}).then(async (connection) => {
	await Discord.start()

	app.post("/verify/:id", async (req: Request, res: Response) => {
		if (!req.body.signature) {
			return res.status(400).json({
				error: "You must include a signature",
			})
		}

		const link = await connection.getRepository(Link).findOne(req.params.id)
		if (!link) {
			return res.status(404).json({
				error: "Invalid id",
			})
		}

		const address = ethers.utils.verifyMessage("Welcome to Starton", req.body.signature)
		const memberRepo = getConnection().getRepository(Member)
		const member = await memberRepo.save({
			memberId: link.memberId,
			guildId: link.guildId,
			address: address,
		})

		await Starton.assignRolesToMember(member)

		return res.json({
			result: "ok",
		})
	})

	app.post("/hook/:id", async (req: Request, res: Response) => {
		const hash = createHmac("sha256", process.env.STARTON_SIGNATURE_KEY as string)
			.update(JSON.stringify(req))
			.digest("hex")

		if (hash !== req.headers["starton-signature"]) {
			return
		}

		try {
			const triggerRepo = getConnection().getRepository(Trigger)
			const trigger = await triggerRepo.findOneOrFail({
				where: {
					id: req.params.id,
				},
			})

			const contractRepo = getConnection().getRepository(Contract)
			const contract = await contractRepo.findOneOrFail({
				where: {
					address: trigger.contractId,
				},
			})

			const memberRepo = getConnection().getRepository(Member)
			const members = await memberRepo.find()

			for (const member of members) {
				if (false) {
					//TODO From or To addresses match the one of a member
					Starton.updateMemberRole(contract, trigger, member)
				}
			}
		} catch (err) {
			console.log(err)
		}
	})

	// start express server
	const port = process.env.PORT || 3333
	app.listen(port)
	console.log(`Api started on port ${port}`)
})

export default app

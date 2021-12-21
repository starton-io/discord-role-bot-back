// create and setup express app
import express, {Request, Response} from "express"
import {Link} from "./entity/link.entity"
import {ethers} from "ethers"
import {createConnection, getConnection} from "typeorm"
import {Discord} from "./discord"
import {StartonRole} from "./role"
import {Member} from "./entity/member.entity"
import { join } from "path"
const cors = require('cors')
require('dotenv').config()

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
    entities: [join(__dirname, '**', '*.entity.{ts,js}')],
    migrations: [
        "src/migration/**/*.ts"
    ],
    subscribers: [
        "src/subscriber/**/*.ts"
    ]
}).then(async connection => {

    await Discord.start()
    await StartonRole.start()

    app.post("/verify/:id", async(req: Request, res: Response) => {
        if (!req.body.signature) {
            return res.status(400).json({
                error: "You must include a signature"
            })
        }

        const link = await connection.getRepository(Link).findOne(req.params.id)
        if (!link) {
            return res.status(404).json({
                error: "Invalid id"
            })
        }

        const address = ethers.utils.verifyMessage('Welcome to Starton', req.body.signature)
        console.log(address)
        const memberRepo = getConnection().getRepository(Member)
        const member = await memberRepo.save({
            memberId: link.memberId,
            guildId: link.guildId,
            address: address
        })
        await StartonRole.assignRolesToMember(member)

        return res.json({
            result: "ok"
        })
    })

    // start express server
    const port = process.env.PORT || 3333
    app.listen(port)
    console.log(`Api started on port ${port}`)

})

export default app

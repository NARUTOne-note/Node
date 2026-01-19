import "reflect-metadata"
import { DataSource } from "typeorm"
import { User } from "./entity/User"

export const AppDataSource = new DataSource({
    type: "mysql",
    host: "localhost",
    port: 3306,
    username: "test",
    password: "test",
    database: "test",
    synchronize: true, // 自动同步数据库结构
    logging: false, // 日志记录
    // entities: [User],
    entities: ['./entity/*.ts'], // 自动加载 entity 目录下的所有 ts 文件
    migrations: [],
    subscribers: [],
    connectorPackage: 'mysql2',
    extra: {
        authPlugin: 'sha256_password', // 使用 sha256_password 插件
    }
})

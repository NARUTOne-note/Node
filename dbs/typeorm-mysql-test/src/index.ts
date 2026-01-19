import { AppDataSource } from "./data-source"
import { User } from "./entity/User"

AppDataSource.initialize().then(async () => {

    console.log("Inserting a new user into the database...")
    const user = new User()
    // user.id = 1 如果 id 有值，则更新，否则插入
    user.firstName = "Timber"
    user.lastName = "Saw"
    user.age = 25
    await AppDataSource.manager.save(user)
    console.log("Saved a new user with id: " + user.id)

    console.log("Loading users from the database...")
    const users = await AppDataSource.manager.find(User)
    console.log("Loaded users: ", users)

    console.log("Here you can setup and run express / fastify / any other framework.")


    // 批量插入
    await AppDataSource.manager.save(User, [
        { firstName: 'ccc', lastName: 'ccc', age: 21},
        { firstName: 'ddd', lastName: 'ddd', age: 22},
        { firstName: 'eee', lastName: 'eee', age: 23}
    ]);

    // 删除
    await AppDataSource.manager.delete(User, 1);
    await AppDataSource.manager.delete(User, [2,3]);


    // 删除单个
    const user = new User();
    user.id = 1;
    await AppDataSource.manager.remove(User, user);

    // 条件查询
    const users = await AppDataSource.manager.findBy(User, {
        age: 23
    });
    console.log(users);


    // 一对一关联
    const usero = new User();
    user.firstName = 'guang';
    user.lastName = 'guang';
    user.age = 20;
    
    const idCard = new IdCard();
    idCard.cardName = '1111111';
    idCard.user = usero;
    
    await AppDataSource.manager.save(usero);
    await AppDataSource.manager.save(idCard);

}).catch(error => console.log(error))



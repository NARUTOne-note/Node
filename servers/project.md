# 项目开发

## 前置知识

mysql 做关系型数据库、redis 做缓存和临时数据存储、minio 做 OSS 服务、docker 和 docker compose 做部署、typeorm 做 ORM 框架等

## 登录信息验证

1、session + cookie

session + cookie 的给 http 添加状态的方案是服务端保存 session 数据，然后把 id 放入 cookie 返回，cookie 是自动携带的，每个请求可以通过 cookie 里的 id 查找到对应的 session，从而实现请求的标识。这种方案能实现需求，但是有 CSRF、分布式 session、跨域等问题，不过都是有解决方案的

![redis-session](./imgs/redis-session.png)

2、jwt

token 的方案常用 json 格式来保存，叫做 json web token，简称 JWT。
JWT 是保存在 request header 里的一段字符串（比如用 header 名可以叫 authorization）

JWT 是由 header、payload、verify signature 三部分组成的：
header 部分保存当前的加密算法，payload 部分是具体存储的数据，verify signature 部分是把 header 和 payload 还有 salt 做一次加密之后生成的。（salt，盐，就是一段任意的字符串，增加随机性）
这三部分会分别做 Base64，然后连在一起就是 JWT 的 header，放到某个 header 比如 authorization 中

- JWT 要搭配 https 来用，让别人拿不到 header
- JWT 里也不要保存太多数据
- 可以配合 redis 来解决，记录下每个 token 对应的生效状态，每次先去 redis 查下 jwt 是否是可用的，这样就可以让 jwt 失效
- 双token无感续签：access_token 用于身份认证，refresh_token 用于刷新 token，也就是续签，在响应是 401 的时候，自动访问 refreshToken 接口拿到新 token，然后再次访问失败的接口。
- 单 token 续签的原理，就是登录后返回 jwt，每次请求接口带上这个 jwt，然后每次访问接口快过期则header返回新的 jwt，然后前端更新下本地的 jwt token。
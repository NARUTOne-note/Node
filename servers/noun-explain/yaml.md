# YAML

> "Yet Another Markup Language"（仍是一种标记语言）

YAML 的语法和其他高级语言类似，并且可以简单表达清单、散列表，标量等数据形态。它使用空白符号缩进和大量依赖外观的特色，特别适合用来表达或编辑数据结构、各种配置文件、倾印调试内容、文件大纲（例如：许多电子邮件标题格式和YAML非常接近）。

YAML 的配置文件后缀为 .yml，如：runoob.yml 。

## 基本语法
大小写敏感
使用缩进表示层级关系
缩进不允许使用 tab，只允许空格
缩进的空格数不重要，只要相同层级的元素左对齐即可
- `#` 表示注释
- `:` 号后面要加空格

## 数据类型
YAML 支持以下几种数据类型：

- 对象：键值对的集合，又称为映射（mapping）/ 哈希（hashes） / 字典（dictionary）
- 数组：一组按次序排列的值，又称为序列（sequence） / 列表（list）
- 纯量（scalars）：单个的、不可再分的值

## YAML 对象

对象键值对使用冒号结构表示 key: value，冒号后面要加一个空格

缩进表示层级关系；

```yml
key: 
    child-key: value
    child-key2: value2
```

## YAML 数组

以 - 开头的行表示构成一个数组：

```yml
- A
- B
- C
companies:
    -
        id: 1
        name: company1
        price: 200W
    -
        id: 2
        name: company2
        price: 500W
```

引用
& 锚点和 * 别名，可以用来引用:

```yml
# 可以被引用，建立锚点
defaults: &defaults
  adapter:  postgres
  host:     localhost

development:
  database: myapp_development
  # 引用defaults 值
  <<: *defaults

test:
  database: myapp_test
  <<: *defaults
```
const express = require('express');
const superagent = require('superagent'); // 是个 http 方面的库，可以发起 get 或 post 请求
const cheerio = require('cheerio'); //  Node.js 版的 jquery，用来从网页中以 css selector 取数据，使用方式跟 jquery 一样一样的。
const eventproxy = require('eventproxy'); // 事件嵌套抹平, 控制嵌套请求并发
const url = require('url');

const app = express();
// 得到一个 eventproxy 的实例
var ep = new eventproxy();

var cnodeUrl = 'https://cnodejs.org/';

app.get('/', function(req, res, next) {
  // 用 superagent 去抓取 https://cnodejs.org/ 的内容
  superagent.get(cnodeUrl)
    .end(function (err, sres) {
      // 常规的错误处理
      if (err) {
        return next(err);
      }
      // sres.text 里面存储着网页的 html 内容，将它传给 cheerio.load 之后
      // 就可以得到一个实现了 jquery 接口的变量，我们习惯性地将它命名为 `$`
      // 剩下就都是 jquery 的内容了
      var $ = cheerio.load(sres.text);
      var items = [];
      var topicUrls = [];
      $('#topic_list .topic_title').each(function (idx, element) {
        var $element = $(element);
        var href = url.resolve(cnodeUrl, $element.attr('href'));
        topicUrls.push(href);
        items.push({
          title: $element.attr('title'),
          href: $element.attr('href')
        });
      });

      // 命令 ep 重复监听 topicUrls.length 次（在这里也就是 40 次） `topic_html` 事件再行动
      ep.after('topic_html', topicUrls.length, function (topics) {
        // topics 是个数组，包含了 40 次 ep.emit('topic_html', pair) 中的那 40 个 pair

        // 开始行动
        topics = topics.map(function (topicPair) {
          // 接下来都是 jquery 的用法了
          var topicUrl = topicPair[0];
          var topicHtml = topicPair[1];
          var $ = cheerio.load(topicHtml);
          return ({
            title: $('.topic_full_title').text().trim(),
            href: topicUrl,
            comment1: $('.reply_content').eq(0).text().trim(),
          });
        });

        console.log('final:');
        console.log(topics);
        res.send(topics);
      });

      // 我们在写爬虫的时候，如果有 1000 个链接要去爬，那么不可能同时发出 1000 个并发链接出去对不对？我们需要控制一下并发的数量，比如并发 10 个就好，然后慢慢抓完这 1000 个链接。
      topicUrls.forEach(function (topicUrl) {
        superagent.get(topicUrl)
          .end(function (err, res) {
            console.log('fetch ' + topicUrl + ' successful');
            ep.emit('topic_html', [topicUrl, res.text]);
          });
      });

    });
})

app.listen(3000, function () {
  console.log('Server listening on localhost:3000 Ctrl+C to stop');
})

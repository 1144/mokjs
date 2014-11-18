## 1.2.6 (2014-11-18)

  - 增加功能：mok-js增加构建数据，用于构建时输出特定代码或注释某些代码
  - 增加功能：CSS支持SASS语法，合并编译CSS时可直接编译`.scss`后缀的文件
  - 增加mok、uglifyjs、uglifyjs.cmd这3个文件，简化uglifyjs压缩命令配置
  - 删除package.json文件
  - 去掉各文件里的小版本号

## 1.2.5 (2014-11-06)

Features:

  - 修改示例项目blog的配置项`format_tag`
  - 优化构建项目时的错误检测方法
  - 增加CHANGELOG.md

Bugfixes:

  - 修复JS和CSS项目构建时缺少版本控制文件就不能正常构建的bug

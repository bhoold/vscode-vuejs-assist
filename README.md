## Introduction

这是一个显示vue文件代码层级结构的vscode扩展，参考了[vscode code outline](https://github.com/patrys/vscode-code-outline)的代码。
安装成功之后，编辑vue文件时将在explorer中显示一个vue view窗口。

![v0.0.1.png](https://github.com/bhoold/vscode-vue-view/raw/master/screenshots/v0.0.1.png)

## Features

相对于code outline的不同，vue view是针对vue项目的，提供更清晰的代码结构，并致力于vue项目的优化。

## Requirements

需要[Vetur](https://marketplace.visualstudio.com/items?itemName=octref.vetur)提供vue标识符支持

<!-- 
## Extension Settings



## Known Issues
-->


## Release Notes

### v0.0.3

1.参考vscode自带的outline加上排序功能。
2.函数显示形参。
3.参考vue的ast解析方式优化代码。

### v0.0.2

script部分改用acorn解析

### v0.0.1

基本显示功能
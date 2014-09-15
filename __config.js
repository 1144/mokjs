/*
	mokjs配置文件，详细请参考：http://mokjs.com/
*/

exports.http_port = 80; //服务器默认监听端口

//项目配置
var projects = {
	'blog': {
		//path是项目代码路径，相对于__config.js这个文件的路径，也可用绝对路径。
		//有多个开发分支时，将路径指到对应分支就行（解决多分支切换开发）。
		path: '../demos/blog/src-node/',
		build_path: '../demos/blog/build/',
		modular_spec: 'CMD1',	//遵循的模块化规范：'CMD' - CMD规范，'Modules' - CommonJS Modules规范
		boot_js: 'abc.js',	//启动文件（种子文件）
		use_base: true,	//是否使用了base.js（base.js是拆分出来的基本库文件或所有页面都用到的文件）
		charset: 'utf8',	//gbk
		//格式化上线tag号。参数tag_num为打包时输入的版本号或某种格式的字符串。
		format_tag: function(tag_num){
			var t = new Date(), M = t.getMonth()+1, d = t.getDate();
			return {
				version: '' + t.getFullYear() + (M>9 ? M : '0'+M) +'/'+ (d>9 ? d : '0'+d) + '/js_' + tag_num + '/',
				folder_name: 'js_' + tag_num	//存放所有更新的文件的文件夹名，在updated目录下。前后都别加反斜线“/”。
			};
		},
		//惰性压缩列表
		lazy_list: {
			//'test.js': true
		}
	},
	'mycss': {
		type: 'css',	//项目类型
		path: '../demos/css/',	 //也可以使用绝对路径
		build_path: '../demos/css-build/',	//构建路径，合并压缩后的css存放的地方
		ver_js: 'version.js',	 //存放版本和MD5信息的文件，可选
		charset: 'utf8',	//gbk。css源文件编码
		//格式化上线tag号，可选
		format_tag: function(tag_num){
			var t = new Date(), M = t.getMonth()+1, d = t.getDate();
			if(!tag_num){
				var h = t.getHours(), m = t.getMinutes();
				h<10 && (h = '0'+h);
				m<10 && (m = '0'+m);
				tag_num = String(h)+String(m);
			}
			//前后都别加反斜线“/”
			return {
				version: '' + t.getFullYear() + (M>9 ? M : '0'+M) +'/'+ (d>9 ? d : '0'+d) + '/css_' + tag_num + '/',
				folder_name: 'css_' + tag_num	//存放有更新的文件的文件夹名，在updated目录下
			};
		}
	},
	'myhtml': {
		type: 'html',	//项目类型
		path: '../demos/html/',	//相对于__config.js的相对路径，推荐使用绝对路径
		build_path: '../demos/www/',	//构建路径
		data: {	//开发时的全局数据
			$root: '//s.m.com/',	//图片、CSS、JS资源
			$jquery: '//libs.baidu.com/jquery/1.11.1/jquery.min.js'
		},
		build_data: {	//构建时的全局数据
			$root: '//mokjs.sinaapp.com/',	 //图片、CSS、JS资源
			$jquery: '//libs.baidu.com/jquery/1.11.1/jquery.min.js'
		},
		charset: 'utf8'	//gbk。html源文件编码
	},
	'air': {
		path: '../demos/air', //源代码路径
		doc_path: '../demos/air-doc', //文档生成到哪里
		charset: 'utf8' //源代码的文件编码
	}
};

//路由表
var routes = {
	'blog.cn': [
		{
			regexp: /^\/js\/(\w+\.js)$/,	//匹配http://blog.cn/js/*.js这样的js请求
			project: 'blog'	//将请求映射到blog项目，regexp里(\w+\.js)部分的值为映射过去文件名
		},
		{
			regexp: /^\/css\/(.+?\.css)$/,	//匹配http://blog.cn/css/*.css这样的css请求
			//说明：/css/a.css会映射到mycss下的a.css，/css/main/test.css会映射到mycss下的main/test.css
			project: 'mycss'	//将请求映射到mycss项目
		},
		{
			regexp: /.*/,	//不满足前面格式的其他任何请求，直接定位到资源位置
			locate: function(match){
				//返回相对于__config.js这个文件的路径，也可用绝对路径
				return '../demos/blog/static' + match[0]; //return 'D:/1144/demos/blog/static' + match[0];
			}
		}
	],
	'm.com': [
		{
			regexp: /^.+?\.html$/,	 //处理所有.html结尾的请求
			project: 'myhtml'
		}, {
			regexp: /.+?\.pre$/,	//以.pre结尾的请求，映射到预览模块
			handler: function(match, request, response, reqpath){
				require('./moktext/html').viewModule(match[0].slice(0,-3)+'html', projects['myhtml'], response);
			}
		}, {
			regexp: /.*?\/$/,	//以/结尾的，请求对应的index.html，实现默认index.html
			project: 'myhtml',
			format: function(match){
				return match[0]+'index.html';
			}
		}, {
			regexp: /.*/,
			locate: function(match){
				return projects['myhtml'].path + match[0];
			}
		}
	],
	's.m.com': [	//图片、CSS和JS资源
		{
			regexp: /.*/,
			locate: function(match){
				return '../demos/www' + match[0];	 //不需要处理的资源，直接定位到资源位置
			}
		}
	],
	'count.cn': [
		{
			//用自定义的模块 处理url符合某种格式的http请求：http://count.cn/3
			//累加最后的数字
			regexp: /^\/(\d+)$/,
			handler: function(match, request, response, reqpath){
				require('./mok_modules/demo').count(match[1], response);
			}
		}
	],
	//js使用同一个域名的不同产品线
	'js.xxx.com': [
		{
			regexp: /^\/(\w+\.js)$/,
			project: 'ecom'
		}, {
			regexp: /^\/test\/(\w+\.js)$/,
			project: 'test',
			format: function(match){	//对js请求路径进行重定向
				return match[1];
			}
		}
	]
};

exports.projects = projects;
exports.routes = routes;

//Uglifyjs压缩
exports.compress_cmd = 'uglifyjs {filename} -m -c unused=true -o {filename}';
//YUI压缩
//exports.compress_cmd = 'java -jar ./mokjs/yuicompressor-2.4.2.jar {filename} -o {filename}';

//mokdoc标签别名配置：tag的别名与tag id的映射
exports.alias2tagid = {
	'method': 'fn',
	'version': 'ver'
};

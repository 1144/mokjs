/*--
	JavaScript模块化
	支持 CMD 和 CommonJS Modules 两种规范
	-site http://mokjs.com/mok-js/
*/
var fs = require('fs'),
	util = require('../common/util'),
	reg_comment = /\/\*[\D\d]*?\*\//g,
	reg_define = /^[\t ]*define[\t ]*\(.+$/m,
	charset, //文件编码，默认utf8
	err_log = [],
	prj_path,

	common_combined = {}, //公共文件common_js文件依赖的，用于排重
	combined_list,
	file_tree,
	tree_deep,
	contents;

//初始化合并
function initCombine(common_js, is_common) {
	combined_list = {};
	if (common_js && !is_common) {
		for (var k in common_combined) {
			combined_list[k] = true;
		}
	}
	file_tree = ['/* file tree:'];
	tree_deep = 0;
	contents = '';
}
//合并文件：采用CMD规范
function combineCMD(file) {
	combined_list[file] = true;
	file_tree.push(util.repeat('|   ', tree_deep)+'|...'+file);
	tree_deep++;

	var file_content = [];
	file_content.push('\r\n/* ===== '+file+' ===== */');

	var lines = fs.readFileSync(prj_path+file, charset).replace(reg_comment, '')
		.replace(/^\s+/, '').replace(/\r/g, '').replace(reg_define, function (mark) {
			return mark.replace(/define[\t ]*\(/, ';(mok["'+
				util.getModuleAbbr(file.slice(0, -3))+'"]=');
		}).split('\n'),
		i = 0, len = lines.length, line, req_ms;
	for (; i < len; i++) {
		line = lines[i];
		if (line.indexOf('require')<0) { //90%以上无require吧
			file_content.push(line);
		} else {
			req_ms = util.parseRequire(line, file);
			file_content.push(req_ms[0]);
			req_ms = req_ms[1]; //复用req_ms
			while (req_ms.length) {
				line = req_ms.shift()+'.js'; //复用line
				if (combined_list[line]) {
					file_tree.push(util.repeat('|   ', tree_deep)+'|.  '+line);
				} else {
					fs.existsSync(prj_path+line) &&
					fs.statSync(prj_path+line).isFile() ?
						combineCMD(line) :
						err_log.push('MOKJS-005: '+file+' 依赖的模块 '+
							line.slice(0, -3)+' 不存在！\nline '+(i+1)+': '+lines[i]);
				}
			}
			
		}
	}
	contents += file_content.join('\r\n');

	tree_deep--;
}

//合并文件：采用CommonJS Modules规范
function combine(file) {
	combined_list[file] = true;
	file_tree.push(util.repeat('|   ', tree_deep)+'|...'+file);
	tree_deep++;

	var file_content = [];
	file_content.push('\r\n/* ===== '+file+' ===== */\r\n'+
		'mok["'+util.getModuleAbbr(file.slice(0, -3))+
		'"]=function(require, module, exports){');

	var lines = fs.readFileSync(prj_path+file, charset).replace(reg_comment, '')
		.replace(/^\s+/, '').replace(/\r/g, '').split('\n'),
		i = 0, len = lines.length, line, req_ms;
	for (; i < len; i++) {
		line = lines[i];
		if (line.indexOf('require')<0) { //90%以上无require吧
			file_content.push(line);
		} else {
			req_ms = util.parseRequire(line, file); //console.log(req_ms)
			file_content.push(req_ms[0]);
			req_ms = req_ms[1]; //复用req_ms
			while (req_ms.length) {
				line = req_ms.shift()+'.js'; //复用line
				if (combined_list[line]) {
					file_tree.push(util.repeat('|   ', tree_deep)+'|.  '+line);
				} else {
					fs.existsSync(prj_path+line) &&
					fs.statSync(prj_path+line).isFile() ?
						combine(line) :
						err_log.push('MOKJS-005: '+file+' 依赖的模块 '+
							line.slice(0, -3)+' 不存在！\nline '+(i+1)+': '+lines[i]);
				}
			}
		}
	}
	file_content.push('};\r\n');
	contents += file_content.join('\r\n');

	tree_deep--;
}

//输出JS
exports.output = function (filename, prj_conf, response) {
	prj_path = prj_conf.path;
	filename = filename[0]==='.' ? util.resolvePath('main/',filename) : 'main/'+filename;
	var file = prj_path+filename,
		cmd_spec = prj_conf.modular_spec==='CMD',
		is_common = filename===prj_conf.common_js;
	response.writeHead(200, {
		'Content-Type': 'application/x-javascript',
		'Cache-Control': 'max-age=0'
	});
		
	if (fs.existsSync(file) && fs.statSync(file).isFile()) {
		charset = prj_conf.charset;
		err_log = [];
		//载入模块简称与全称的映射
		util.loadModuleAbbr(prj_path);
		initCombine(prj_conf.common_js, is_common);
		cmd_spec ? combineCMD(filename) : combine(filename);
		if (err_log.length) {
			response.end('!alert("'+err_log.join('\\n\\n')
				.replace(/\n/g,'\\n').replace(/"/g,'\\"')+'");');
			console.log(err_log.join('\n'));
		} else {
			response.write(file_tree.join('\r\n')+'\r\n*/\r\n');
			response.write(fs.readFileSync(cmd_spec ? 'mok-js/br-mok-CMD.js' :
				'mok-js/br-mok-Modules.js', 'utf8'));
			response.end(contents+'\r\nrequire("'+filename.slice(0, -3)+'");\r\n');
		}
		is_common && prj_conf.common_js && (common_combined = combined_list);
		err_log = contents = combined_list = null;
	} else {
		response.end('!alert("MOKJS-404: Not found. Wrong path ['+file+'].");');
	}
};

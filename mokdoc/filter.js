
/*--
	文件过滤器
	通过文件名、文件后缀或文件路径进行排除
	-p string filename 文件名
	-p string filepath 文件所在路径
	-r 返回false将不提取该文件的注释
*/
exports.file_filter = function(filename, filepath){
	//这里只从js文件里提取注释。
	return filename.slice(-3) === '.js';
};

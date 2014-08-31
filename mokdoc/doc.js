
module.exports = function(){
	return {
		//存储tag标签里提取的数据。你可自行添加你想保存的数据。
		db: {
			dict_list: [], //数据字典列表
			dict_content: {}, //数据字典数据
			know: [] //代码维护、项目维护的知识库
		},

		//记录一些全局的状态
		scope: {
			ns: '', //记录前面的 或 addto标签指定的命名空间（或者类名等）
			f: '', //当前文件（包括文件路径）
			dicted: {} //已经创建了的字典表
		},

		status: {}, //记录当前注释块的一些数据，如ns命名空间等状态

		err_log: [], //收集错误或警告信息

		//将data数组字符串化
		stringify: function(data){
			//console.log(data);
			//丢弃data的第一行
			var res = '', i = 1, len = data.length;
			for(; i < len; i++){
				res += data[i].replace(/^[\t ]+/, '');
			}
			return res;
		}
	};
};


/*--
	�ļ�������
	ͨ���ļ������ļ���׺���ļ�·�������ų�
	-p string filename �ļ���
	-p string filepath �ļ�����·��
	-r ����false������ȡ���ļ���ע��
*/
exports.file_filter = function(filename, filepath){
	//����ֻ��js�ļ�����ȡע�͡�
	return filename.slice(-3) === '.js';
};

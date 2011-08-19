var Session = Model.define('session', {
	beforeSave: function () {
		this.updateTimestamp('date:modified');
		this.doc['date:modified']= this['date:modified'];
	}
});
global.Session = Session;
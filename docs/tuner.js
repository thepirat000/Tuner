$(document).ready(function () {
	$("#btn-scan").click(e => {
		e.preventDefault();
		Scan();
	});

});

async function Scan() {
	const device = await navigator.bluetooth.requestDevice({
        filters: [{namePrefix: ['Tuner by ThePirat']}]});
	let name = device.name;
	let id = device.id;
	alert(name + " " + id);
	const server = await device.gatt.connect();
	const services = await server.getPrimaryServices();
	const service = await services[0];
	let characteristicCmd = await service.getCharacteristic('ca000000-fede-fede-0000-000000000001');
	let valueFreq = characteristicCmd.readValue();
	alert("F: " + valueFreq.getString());
	let characteristicDuties = await service.getCharacteristic('ca000000-fede-fede-0000-000000000002');
	let valueDuties = characteristicCmd.readValue();
	alert("D: " + valueDuties.getString());
}

$(document).ready(function () {
	$("#btn-scan").click(e => {
		e.preventDefault();
		Scan();
	});

});

async function Scan() {
	const device = await navigator.bluetooth.requestDevice({
        filters: [{services: ['fe000000-fede-fede-0000-000000000000']}]});
	let name = device.name;
	let id = device.id;
	alert(name + " " + id);
	const server = await device.gatt.connect();
	const service = await server.getPrimaryService('fe000000-fede-fede-0000-000000000000');
	let characteristicCmd = await service.getCharacteristics('ca000000-fede-fede-0000-000000000001')[0];
	let valueFreq = characteristicCmd.readValue();
	alert("F: " + valueFreq);
	let characteristicDuties = await service.getCharacteristics('ca000000-fede-fede-0000-000000000002')[0];
	let valueDuties = characteristicCmd.readValue();
	alert("D: " + valueDuties);
}

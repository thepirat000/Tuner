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

	const server = await device.gatt.connect();
	const service = await server.getPrimaryService('fe000000-fede-fede-0000-000000000000');
	let characteristicCmd = await service.getCharacteristics('ca000000-fede-fede-0000-000000000001');
	let valueFreq =	new TextDecoder().decode(await characteristicCmd[0].readValue());
	let characteristicDuties = await service.getCharacteristics('ca000000-fede-fede-0000-000000000002');
	let valueDuties = new TextDecoder().decode(await characteristicDuties[0].readValue());
	alert("D: " + valueDuties + '\nF: ' + valueFreq);
}

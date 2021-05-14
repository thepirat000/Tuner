$(document).ready(function () {
	GenerateOscillatorsUI();
	$("#btn-scan").click(e => {
		e.preventDefault();
		Scan();
	});
	
	$('#command').bind('keypress', function (e) {
		if(e.which == 13) {
			sendCommand();
		}
	});
	$("#send-command").click(e => {
		e.preventDefault();
		sendCommand();
	});
	
	//$("#command").focus();
	//$(window).scrollTop(0);

});

var characteristicCmd;
var characteristicDuties;
var characteristicFreqs;
var device;
const encoder = new TextEncoder('utf-8');

async function Scan() {
	if (device && device.gatt.connected) {
		device.gatt.disconnect();
	}
	try {
		device = await navigator.bluetooth.requestDevice({
			filters: [{
				namePrefix: 'Tuner'
			}],
			optionalServices: ['fe000000-fede-fede-0000-000000000000']});
	} catch(err) {
		alert(err);
	}
	$("#title").text(device.name);
	device.addEventListener('gattserverdisconnected', onDisconnected);
	await connectDeviceAndCacheCharacteristics();
}

async function GetFreqs() {
	let valueFreq =	new TextDecoder().decode(await characteristicCmd.readValue());
	return valueFreq;
}

async function GetDuties() {
	let valueDuties = new TextDecoder().decode(await characteristicDuties.readValue());
	return valueDuties;
}

async function onDisconnected() {
	console.log("Reconnect");
	await connectDeviceAndCacheCharacteristics();
}

async function connectDeviceAndCacheCharacteristics() {
	if (device.gatt.connected && characteristicCmd) {
		return;
	}
	try {
		const server = await device.gatt.connect();
		const service = await server.getPrimaryService('fe000000-fede-fede-0000-000000000000');
		characteristicFreqs = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000001'))[0];
		characteristicFreqs.addEventListener('characteristicvaluechanged', handleFreqValueChange);
		await characteristicFreqs.startNotifications();
		characteristicDuties = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000002'))[0];
		characteristicDuties.addEventListener('characteristicvaluechanged', handleDutyValueChange);
		await characteristicDuties.startNotifications();
		characteristicCmd = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000099'))[0];
		characteristicCmd.addEventListener('characteristicvaluechanged', handleCmdValueChange);
		await characteristicCmd.startNotifications();
	}
	catch (err) {
		alert(err);
	}
	$("#oscillators").show();
}

function handleFreqValueChange(event) {
	let freqs = new TextDecoder().decode(event.target.value);
	console.log(freqs);
	let freqsArray = freqs.split(',');
	for (let i = 0; i < freqsArray.length; ++i) {
		ShowFreqValue(i+1, freqsArray[i]);
	}
}

function handleDutyValueChange(event) {
	let duties  = new TextDecoder().decode(event.target.value);
	console.log(duties);
	let dutiesArray = duties.split(',');
	for (let i = 0; i < dutiesArray.length; ++i) {
		ShowDutyValue(i+1, dutiesArray[i]);
	}
}

function handleCmdValueChange(event) {
	let value  = new TextDecoder().decode(event.target.value);
	
	let cmdOut = $('#command-output');
	if (value[value.length-1] == "\n") {
		value = value.replace("\n", "&#13;&#10;");
	}
	cmdOut.append(value); 
	cmdOut.scrollTop(cmdOut[0].scrollHeight - cmdOut.height());
}

async function sendCommand() {
	let cmd = $("#command").val();
	if (cmd) {
		let value = encoder.encode(cmd);
		characteristicCmd.writeValue(value);
	}
	$("#command").val("");
}

function GenerateOscillatorsUI() {
	for (let i = 2; i <= 4; ++i) {
		let clone = $("#osc-1").clone();
		clone.attr("id", clone.attr("id").substring(0, clone.attr("id").length - 1) + i);
		clone.find('[id]').each(function () { 
			if (this.id.endsWith("-1")) {
				this.id = this.id.substring(0, this.id.length - 1) + i;
			}
		});
		$(clone).find("#osc-id-" + i).text(i);
		$("#oscillators").append(clone);
	}
}

function ShowFreqValue(osc, value) {
	$("#freq-" + osc).text(parseFloat(value).toFixed(2));
	$("#slider-freq-" + osc).val(value);
}
// value: 0-100
function ShowDutyValue(osc, value) {
	$("#duty-text-" + osc).text(parseFloat(value).toFixed(0));
	$("#slider-duty-" + osc).val(value);
}



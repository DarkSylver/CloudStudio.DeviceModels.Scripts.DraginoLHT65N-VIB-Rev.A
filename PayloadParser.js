function parseUplink(device, payload) {

    var payloadb = payload.asBytes();
    var decoded = Decoder(payloadb, payload.port);
    env.log(decoded);

    // Store battery
    if (decoded.BatV != null) {
        var sensor1 = device.endpoints.byAddress("1");
        if (sensor1 != null) {
            sensor1.updateVoltageSensorStatus(decoded.BatV);
            device.updateDeviceBattery({ voltage: decoded.BatV });
        }
    }

    // Buscar el endpoint específico por su dirección
    var sensor2 = device.endpoints.byAddress("2");

    // Store Vibration Count
    if (decoded.vib_count != null && sensor2) {
        sensor2.updateGenericSensorStatus(decoded.vib_count);
    }

    // Función para restar horas a la fecha actual en UTC
    const subtractHours = (date, hours) => { 
        let result = new Date(date); 
        result.setHours(result.getHours() - hours); 
        return result; 
    };

    // Función para obtener la fecha de ayer en UTC
    const getYesterday = () => {
        let yesterday = new Date(utils.utcNow);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0); // Inicio del día
        return yesterday;
    };

    // ---- Cálculo del conteo horario ----
    if (sensor2) {
        let currentState = sensor2.getCurrentState();
        let currentValue = currentState ? currentState.value : null;

        let pastState = sensor2.getDataPoints(subtractHours(utils.utcNow, 1));
        let pastValue = (pastState.length > 0) ? pastState[0].value : null;

        if (currentValue !== null && pastValue !== null) {
            let differenceh = currentValue - pastValue;
            env.log("Diferencia en la última hora: " + differenceh);

            var sensor3 = device.endpoints.byAddress("3");
            if (sensor3 != null) {
                sensor3.updateGenericSensorStatus(differenceh);
            } else {
                env.log("No se encontró el endpoint 3 para almacenar la diferencia.");
            }
        } else {
            env.log("No se encontraron datos suficientes para calcular la diferencia.");
        }
    } else {
        env.log("No se encontró el endpoint 2 con la dirección especificada.");
    }

    // ---- Cálculo del conteo diario ----
    if (sensor2) {
        let yesterday = getYesterday();
        let dailyData = sensor2.getDataPoints(yesterday);

        if (dailyData.length > 1) {
            let firstValue = dailyData[0].value;
            let lastValue = dailyData[dailyData.length - 1].value;
            let dailyDifference = lastValue - firstValue;

            env.log("Diferencia en el último día: " + dailyDifference);

            var sensor4 = device.endpoints.byAddress("4");
            if (sensor4 != null) {
                sensor4.updateGenericSensorStatus(dailyDifference);
            } else {
                env.log("No se encontró el endpoint 4 para almacenar la diferencia diaria.");
            }
        } else {
            env.log("No se encontraron suficientes datos para calcular la diferencia diaria.");
        }
    }

    // ---- Procesar DATALOG para las vibraciones en X, Y, Z ----
    if (decoded.DATALOG != null) {
        let datalogStr = decoded.DATALOG;
        // Se asume que el string contiene grupos en el formato:
        // "[(X),(Y),(Z)],[(X),(Y),(Z)],..."
        // Usamos una expresión regular para extraer todos los números (incluyendo negativos y decimales)
        let matches = datalogStr.match(/-?\d+\.\d+/g);
        if (matches != null) {
            let valuesX = [];
            let valuesY = [];
            let valuesZ = [];
            // Cada grupo de 3 números corresponde a X, Y y Z
            for (let i = 0; i < matches.length; i += 3) {
                valuesX.push(parseFloat(matches[i]));
                valuesY.push(parseFloat(matches[i + 1]));
                valuesZ.push(parseFloat(matches[i + 2]));
            }
            // Por ejemplo, calculamos el promedio de cada eje
            let avgX = valuesX.reduce((a, b) => a + b, 0) / valuesX.length;
            let avgY = valuesY.reduce((a, b) => a + b, 0) / valuesY.length;
            let avgZ = valuesZ.reduce((a, b) => a + b, 0) / valuesZ.length;

            env.log("Promedio vibración X: " + avgX + " | Y: " + avgY + " | Z: " + avgZ);

            // Guardar los valores promedio en endpoints (por ejemplo, 6 para X, 7 para Y y 8 para Z)
            var sensorX = device.endpoints.byAddress("6");
            var sensorY = device.endpoints.byAddress("7");
            var sensorZ = device.endpoints.byAddress("8");

            if (sensorX != null) {
                sensorX.updateGenericSensorStatus(avgX);
            } else {
                env.log("No se encontró el endpoint 6 para almacenar la vibración en X.");
            }

            if (sensorY != null) {
                sensorY.updateGenericSensorStatus(avgY);
            } else {
                env.log("No se encontró el endpoint 7 para almacenar la vibración en Y.");
            }

            if (sensorZ != null) {
                sensorZ.updateGenericSensorStatus(avgZ);
            } else {
                env.log("No se encontró el endpoint 8 para almacenar la vibración en Z.");
            }
        } else {
            env.log("No se pudieron extraer los datos numéricos de DATALOG.");
        }
    }


    // Store Tiempo de Trabajo
    if (decoded.work_min != null) {
        var sensor5 = device.endpoints.byAddress("5");
        if (sensor5 != null) {
            sensor5.updateGenericSensorStatus(decoded.work_min);
        }
    }
}

function buildDownlink(device, endpoint, command, payload) 
{ 
	// This function allows you to convert a command from the platform 
	// into a payload to be sent to the device.
	// Learn more at https://wiki.cloud.studio/page/200

	// The parameters in this function are:
	// - device: object representing the device to which the command will
	//   be sent. 
	// - endpoint: endpoint object representing the endpoint to which the 
	//   command will be sent. May be null if the command is to be sent to 
	//   the device, and not to an individual endpoint within the device.
	// - command: object containing the command that needs to be sent. More
	//   information at https://wiki.cloud.studio/page/1195.

	// This example is written assuming a device that contains a single endpoint, 
	// of type appliance, that can be turned on, off, and toggled. 
	// It is assumed that a single byte must be sent in the payload, 
	// which indicates the type of operation.

/*
	 payload.port = 25; 	 	 // This device receives commands on LoRaWAN port 25 
	 payload.buildResult = downlinkBuildResult.ok; 

	 switch (command.type) { 
	 	 case commandType.onOff: 
	 	 	 switch (command.onOff.type) { 
	 	 	 	 case onOffCommandType.turnOn: 
	 	 	 	 	 payload.setAsBytes([30]); 	 	 // Command ID 30 is "turn on" 
	 	 	 	 	 break; 
	 	 	 	 case onOffCommandType.turnOff: 
	 	 	 	 	 payload.setAsBytes([31]); 	 	 // Command ID 31 is "turn off" 
	 	 	 	 	 break; 
	 	 	 	 case onOffCommandType.toggle: 
	 	 	 	 	 payload.setAsBytes([32]); 	 	 // Command ID 32 is "toggle" 
	 	 	 	 	 break; 
	 	 	 	 default: 
	 	 	 	 	 payload.buildResult = downlinkBuildResult.unsupported; 
	 	 	 	 	 break; 
	 	 	 } 
	 	 	 break; 
	 	 default: 
	 	 	 payload.buildResult = downlinkBuildResult.unsupported; 
	 	 	 break; 
	 }
*/

}

function datalog(i,bytes){
  var aa= parseFloat((bytes[i]<<24>>16 | bytes[i+1])/1000).toFixed(3); 
  var bb= parseFloat((bytes[i+2]<<24>>16 | bytes[i+3])/1000).toFixed(3); 
  var cc= parseFloat((bytes[i+4]<<24>>16 | bytes[i+5])/1000).toFixed(3); 
  var string='[('+ aa +'),'+'('+ bb +'),' +'('+ cc +')]'+',';  
  return string;
}

function Decoder(bytes, port) {
  if(port==0x02)
  {
    var decode = {};
    decode.BatV=(bytes[0]<<8 | bytes[1])/1000;
    var mod=(bytes[2]>>2)&0x07;
    if(mod==1)
    {
      decode.vib_count=(bytes[3]<<8 | bytes[4]<<8 | bytes[5]<<8 | bytes[6])>>>0;
      decode.work_min=(bytes[7]<<8 | bytes[8]<<8 | bytes[9]<<8 | bytes[10])>>>0;
    }
    else if(mod==2)
    {
      decode.vib_count=(bytes[3]<<8 | bytes[4]<<8 | bytes[5]<<8 | bytes[6])>>>0;    
      decode.TempC_SHT=parseFloat(((bytes[7]<<24>>16 | bytes[8])/100).toFixed(2));
      decode.Hum_SHT=parseFloat((((bytes[9]<<8 | bytes[10])&0xFFF)/10).toFixed(1));
    }
    else if(mod==3)
    {
      decode.TempC_SHT=parseFloat(((bytes[3]<<24>>16 | bytes[4])/100).toFixed(2));
      decode.Hum_SHT=parseFloat((((bytes[5]<<8 | bytes[6])&0xFFF)/10).toFixed(1));
      decode.work_min=(bytes[7]<<8 | bytes[8]<<8 | bytes[9]<<8 | bytes[10])>>>0;
    }

    decode.Alarm= (bytes[2] & 0x01)? "TRUE":"FALSE";
    decode.TDC  = (bytes[2] & 0x02)? "YES":"NO";
    
    if(bytes.length==11)
      return decode;
  }
  else if(port==7)
  {
    var Bat= (bytes[0]<<8 | bytes[1])/1000;
    for(var k=2;k<bytes.length;k=k+6)
    {
      data= datalog(k,bytes);
      if(k=='2')
        data_sum=data;
      else
        data_sum+=data;
    }
    return{
    Bat_V:Bat,
    DATALOG:data_sum
    };    
  }  
  else if(port==5)
  {
  	var freq_band;
  	var sub_band;
    var sensor;
    
    if(bytes[0]==0x3F)
      sensor= "LHT65N-VIB";
      
	  var firm_ver= (bytes[1]&0x0f)+'.'+(bytes[2]>>4&0x0f)+'.'+(bytes[2]&0x0f);
	  
    if(bytes[3]==0x01)
        freq_band="EU868";
  	else if(bytes[3]==0x02)
        freq_band="US915";
  	else if(bytes[3]==0x03)
        freq_band="IN865";
  	else if(bytes[3]==0x04)
        freq_band="AU915";
  	else if(bytes[3]==0x05)
        freq_band="KZ865";
  	else if(bytes[3]==0x06)
        freq_band="RU864";
  	else if(bytes[3]==0x07)
        freq_band="AS923";
  	else if(bytes[3]==0x08)
        freq_band="AS923_1";
  	else if(bytes[3]==0x09)
        freq_band="AS923_2";
  	else if(bytes[3]==0x0A)
        freq_band="AS923_3";
  	else if(bytes[3]==0x0F)
        freq_band="AS923_4";
  	else if(bytes[3]==0x0B)
        freq_band="CN470";
  	else if(bytes[3]==0x0C)
        freq_band="EU433";
  	else if(bytes[3]==0x0D)
        freq_band="KR920";
  	else if(bytes[3]==0x0E)
        freq_band="MA869";
  	
    if(bytes[4]==0xff)
      sub_band="NULL";
	  else
      sub_band=bytes[4];

    var bat= (bytes[5]<<8 | bytes[6])/1000;
    
  	return {
  	  SENSOR_MODEL:sensor,
      FIRMWARE_VERSION:firm_ver,
      FREQUENCY_BAND:freq_band,
      SUB_BAND:sub_band,
      BAT:bat,
  	}
  }  
}
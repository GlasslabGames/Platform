/*************************************************************************************************************
 *
 *	esi.js
 *
 *	Description: Erase student info admin panel
 *
 *	Comments: 
 *
 *************************************************************************************************************/

(function (esiAdminPanel)
{
	/**
	 * Sets up the example buttons
	 * @param divID The id of the div containing the buttons
	 */
	(esiAdminPanel.Init = function(divID)
	{
		// Get all the keys from document
		var keys = document.querySelectorAll("#" + divID + " span"); // Note: looking for all spans seems dangerous...

		// Add an onclick function to each of the keys.
		for (var i = 0; i < keys.length; i++)
		{
			keys[i].onclick = function(event)
			{
				// Get the input and button values
				var input = document.querySelector(".commandButtons");
				var button = this.innerHTML;
				
				if (button == "Connect")
					InitializeSDK();
				else if (button == "local")
					LocalInitSDK();
				else if (button == "Login")
					Login();


				else if (button == "Erase student account")
					Erase_student_button_pushed();

                else if (button == "Erase instructor account")
					Erase_instructor_button_pushed();
     

				else if (button == "Logout")
					Logout();


				else
					console.log("onclick Unknown button name: " + button);
				
				// prevent page jumps
				event.preventDefault();
			}
		}
	});

	/** Initializes the sdk by connecting to the glass lab development server. */
	function InitializeSDK()
    {
        // First check if the GlassLab SDK object is even defined.
        // If not, we're done proceeding but want to message that the SDK could not be loaded.
        // The SDK won't load when testing on the local file system, but will when run from a web server.
        if (typeof GlassLabSDK == "undefined")
        {
            // SDK is unavailable
           	SetOutput("GlassLabSDK is missing.");
            console.log( "esiAdminPanel.InitializeSDK: The SDK is unavailable!" );
            return;
        }

        // We're now attempting to initialize the SDK
        var _this = esiAdminPanel;
        var gameID = "TEST";    // where do we find valid game IDs?

        console.log( "esiAdminPanel.InitializeSDK: Pending connection to the server..." );

        // Attempt to connect to the server. Set the URI if the host is not playfully.org
        // TODO: check if the host is playfully.org and ignore setting the URI

//		GlassLabSDK.connect( gameID, "https://dev.playfully.org:8043",
//		GlassLabSDK.connect( gameID, "https://stage.playfully.org",
//		GlassLabSDK.connect( gameID, "https://developer.playfully.org",
//		GlassLabSDK.connect( gameID, "https://glasslabgames.org",
//		GlassLabSDK.connect( gameID, "http://dev.playfully.org:8001",
//		GlassLabSDK.connect( gameID, "http://stage.playfully.org:8080",
//		GlassLabSDK.connect( gameID, "http://developer.playfully.org",
//      GlassLabSDK.connect( gameID, "http://localhost:8001",

        GlassLabSDK.connect( gameID, "http://localhost:8001",
	        function( data )
	        {
	            console.log("esiAdminPanel.InitializeSDK: Connection successful: " + data );
				SetStatus('#connect-status', 'Connection', 'success');
				SetData('#connect-data', data);
	        },
	        function( data )
	        {
	            console.log("esiAdminPanel.InitializeSDK: Connection failed: " + data );
				SetStatus('#connect-status', 'Connection', 'failed');
				SetData('#connect-data', data);
	        });
    }

	/** Initializes the sdk by connecting locally and logging locally. */
	function LocalInitSDK()
    {
        // First check if the GlassLab SDK object is even defined.
        // If not, we're done proceeding but want to message that the SDK could not be loaded.
        // The SDK won't load when testing on the local file system, but will when run from a web server.
        if (typeof GlassLabSDK == "undefined")
        {
            // SDK is unavailable
         	SetOutput("GlassLabSDK is missing.");
            console.log( "esiAdminPanel.InitializeSDK: The SDK is unavailable!" );
            return;
        }

        // Manually set local logging for the SDK
    	GlassLabSDK.setOptions( { localLogging: true, dispatchQueueUpdateInterval: 500 } );
    	console.log( "esiAdminPanel.InitializeSDK:  Local instance..." );

    	// Turn on console logging
    	GlassLabSDK.displayLogs();
	}

	/** Logs in to the glass lab services. */
	function Login()
	{
		var username = document.getElementById('gl-username').value;
		var password = document.getElementById('gl-password').value;
		GlassLabSDK.login(username, password,
			function (data)
			{
				console.log("esiAdminPanel.Login: Success: " + data );
				SetStatus('#login-status', 'Login', 'success');
				SetData('#login-data', data);
			},
			function (data)
			{
	            console.log("esiAdminPanel.Login: Fail: " + data );
				SetStatus('#login-status', 'Login', 'error');
				SetData('#login-data', data);
			});
	}

	/** Logs out the current user from the glass lab services. */
	function Logout()
	{
		GlassLabSDK.logout(function(data)
			{
	            console.log("esiAdminPanel.Logout: Success: " + data );
	            SetOutputZ02('.output', "logout success", data);
			},
			function (data)
			{
	            console.log("esiAdminPanel.Logout: Fail: " + data );
	            SetOutputZ02('.output', "logout error", data);
			});
	}

	/** remove student login data from db */
	function Erase_student_button_pushed()
	{

		SetStatus('#del-status', 'waiting');
		SetData('#del-data', 'operation did not complete');

		var studentid = document.getElementById('gl-studentId').value;

        GlassLabSDK.EraseStudentInfo(
        	{
				// test_not_id: "abcefg",
				id: studentid
        	},
        	function(data)
			{
	            console.log(" EraseStudentInfo : Success: " + data );

	            SetStatus('#del-status', 'EraseStudentInfo', 'success');
	            SetData('#del-data', 'data from call = '+data);
			},
			function (data)
			{
	            console.log(" EraseStudentInfo : Fail: " + data );

	            SetStatus('#del-status', 'EraseStudentInfo', 'error');
	            SetData('#del-data', 'data from call = '+data);
			});
    }

 
	/** remove student login data from db */
	function Erase_instructor_button_pushed()
	{
        SetStatus('#del-status', 'waiting');
        SetData('#del-data', 'operation did not complete');
 
        var instructorid = document.getElementById('gl-instructorId').value;
 
        GlassLabSDK.EraseInstructorInfo(
          {
                // test_not_id: "abcefg",
                id: instructorid
          },
          function(data)
          {
              console.log(" EraseInstructorInfo : Success: " + data );
              
              SetStatus('#del-status', 'EraseInstructorInfo', 'success');
              SetData('#del-data', 'data from call = '+data);
          },
          function (data)
          {
              console.log(" EraseInstructorInfo : Fail: " + data );
              
              SetStatus('#del-status', 'EraseInstructorInfo', 'error');
              SetData('#del-data', 'data from call = '+data);
          });
    }
 
	/** Gets authorization status about the current user. */
	function GetAuthStatus()
	{
		GlassLabSDK.getAuthStatus(function(data)
			{
	            console.log("esiAdminPanel.GetAuthStatus: Success: " + data );
	            SetOutput("getAuthStatus success", data);
			},
			function (data)
			{
	            console.log("esiAdminPanel.GetAuthStatus: Fail: " + data );
	            SetOutput("getAuthStatus error", data);
			});
	}





	/** Gets information about the current user. */
	function GetUserInfo()
	{
		GlassLabSDK.getUserInfo(function(data)
			{
	            console.log("esiAdminPanel.GetUserInfo: Success: " + data );
	            SetOutput("getUserInfo success", data);
			},
			function (data)
			{
	            console.log("esiAdminPanel.GetUserInfo: Fail: " + data );
	            SetOutput("getUserInfo error", data);
			});
	}


	/**
	 * Finds the output div and puts some text into it.
	 * @param name The name of the command that is doing the output.
	 * @param data The results from the server.
	 */
	function SetOutput(name, data)
	{
		var output = document.querySelector(".output");
		if (output != null)
			output.innerHTML = "<h3 style=\"text-align:left\">Command : " + name +
                "<br></h3> output:<br></h3>" + data + "<br><br>";
	}



	function SetStatus(field, name, status)
	{
		var output = document.querySelector(field);
		if (output != null)
			output.innerHTML = '<br><div style="text-align:center">'+ name +' Status: <b>' +
			status + '</b> <br></div>';
	}

	function SetData(field, data)
	{
		var output = document.querySelector(field);
		if (output != null)
			output.innerHTML = '<br>Output: <samp>' + data + '</samp>';
	}








	function SetOutputZ02(field, status, data)
	{
		// e.g. field == ".output"
		var output = document.querySelector(field);
		if (output != null)
			output.innerHTML = '<br><div style="text-align:center">Connect Status: <b>' + status + '</b> <br></div>';
//			output.innerHTML = "<h3 style=\"text-align:left\">Command : " + status +
//			"<br></h3> output:<br></h3>" + data + "<br><br>";
	}





	function SetConnectOutput(status, data)
	{
		var conOutStatus = document.querySelector("#connect-status");
		var conOutData = document.querySelector("#connect-data");
		if (conOutStatus != null)
			conOutStatus.innerHTML = '<br><div style="text-align:center">Connect Status: <b>' + status + '</b> <br></div>';
		if (conOutData != null)
			conOutData.innerHTML = '<br>Output: <samp>' + data + '</samp>';
			// output.innerHTML = "<br><h4 style=\"text-align:left\">Connect Status: " + status + "</h4>" +
			// "<br> output: " + data + "<br>";
// output.innerHTML = "<br><h4 style=\"text-align:left\">Connect Status: " + status + "</h4>" +
// "<br> output: " + data + "<br>";
	}

})(esiAdminPanel = esiAdminPanel||{});
var esiAdminPanel;
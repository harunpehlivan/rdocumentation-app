(function($) {
  /*
  helper function for interaction with rstudio
  */
  var _rStudioRequest=function(url,method,shared_secret,port,params){
    var data={};
    data.method = method;
    //data.params = [$('.R').text()];
    data.params = params;
    data.clientId = '33e600bb-c1b1-46bf-b562-ab5cba070b0e';
    data.clientVersion = "";

    return $.ajax({
      url: 'http://127.0.0.1:'+port+url,
      headers:
      {
          'Accept':'application/json',
          'Content-Type':'application/json',
          'X-Shared-Secret':shared_secret
      },
      type: 'POST',
      dataType: 'json',
      data: JSON.stringify(data),
      processData: false,
      crossDomain:true,
      xhrFields: {
        withCredentials: true
      }
    });
  };

  RStudioRequests = {


    /*
    Helper function to store credentials in Rstudio and to stay loggedIn for fututre ajax request
    */
    logInForRstudio: function(loginData){
      return _rStudioRequest('/rpc/execute_r_code','execute_r_code',urlParam("RS_SHARED_SECRET"),urlParam("Rstudio_port"),
        ["dir.create(paste0(find.package('Rdocumentation'),'/config')) \n write('"+ loginData +"', file = paste0(find.package('Rdocumentation'),'/config/creds.txt'))"])
      .then(function(){
        console.log("Stored creds in RStudio");
        return RStudio.stayLoggedIn(loginData);
      });
    },

    /*
    function to run the examples on a topic page
    */
    runExamples: function(e){
      e.preventDefault();
      var package = $(".packageData").data("package-name");
      var version = $(".packageData").data("latest-version");
      RStudioRequests.checkPackageVersion(package,version).then(function(installed){
        if(installed===0|| installed==-1){
          var examples= $('.topic').find('.topic--title').filter(function(i,el){
            return $(this).text()=="Examples";
          }).parent().find('.R').text();
          _rStudioRequest('/rpc/console_input','console_input',urlParam("RS_SHARED_SECRET"),urlParam("Rstudio_port"),["require("+package+")\n"+examples]);
        }
      });
      return false;
    },

    /*
    function for the 'make default' button
    */
    setDefault: function(e){
      e.preventDefault();
      _rStudioRequest('/rpc/console_input','console_input',urlParam("RS_SHARED_SECRET"),urlParam("Rstudio_port"),["Rdocumentation::makeDefault()"]);
      return false;
    },

    /*
    function for the 'continue without making default' button
    */
    hideViewer: function(e){
      e.preventDefault();
      _rStudioRequest('/rpc/console_input','console_input',urlParam("RS_SHARED_SECRET"),urlParam("Rstudio_port"),["Rdocumentation::hideViewer()"]);
      return false;
    },


    /************************************************************************************************************************************************
    checking installation of package and package version
    ************************************************************************************************************************************************/

    /*
    helper function to check the package version
    */
    checkPackageVersion: function(package,version){
      version = String(version).replace("-",".")
      return _rStudioRequest('/rpc/execute_r_code','execute_r_code',urlParam("RS_SHARED_SECRET"),urlParam("Rstudio_port"),["check_package('"+package+"','"+version+"')"])
      .then(function(result){
          return parseInt(result.result);
      });
    },

    /*
    function to hide/show elements dependent on package installation
    */
    packageVersionControl: function(){
      var packageName = $(".packageData").data("package-name");
      var version = $(".packageData").data("latest-version");
      if(packageName){
        RStudioRequests.checkPackageVersion(packageName,version).then(function(installed){
          if(installed==1){
            $('.versionCheck').html('<button type="button" id="js-install" class="btn btn-large pull-right btn-primary js-external">Install</button>');
            $('.visible-installed').hide();
          }
          else if(installed==-1){
            $('.versionCheck').html('<button type="button" id="js-install" class="btn btn-large pull-right btn-primary js-external">Update</button>');
          }
          else{
            $('.versionCheck').html('<i class="fa fa-check icon-green" aria-hidden="true"></i><span class="latest">You have the latest version<span>');
          }
          $('#js-install').unbind('click',RStudioRequests.installpackage);
          $('#js-install').bind('click',RStudioRequests.installpackage);
        });
      }
    },

    /*
    function for the install button
    */
    installpackage: function(e){
      e.preventDefault();
      var packageName = $(".packageData").data("package-name");
      var packageSource= $(".packageData").data("type-id");
      _rStudioRequest('/rpc/console_input','console_input',urlParam("RS_SHARED_SECRET"),urlParam("Rstudio_port"),
                ["install_package('"+packageName+"',"+packageSource+")"]);
      return false;
    },

    /*
    function to run user-defined examples
    */
    executePackageCode: function(package,code){
      _rStudioRequest('/rpc/console_input','console_input',urlParam("RS_SHARED_SECRET"),urlParam("Rstudio_port"),["require("+package+")\n"+code]);
    }

  };


})($jq);

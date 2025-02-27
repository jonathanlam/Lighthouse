var DOM = require('jsx-dom-factory');
var _ = require('underscore');
var ReturnTeamsActiveAtLHQ = require('../../../lib/getteams.js');
var postCodes = require('../../../lib/postcodes.js');
var sesAsbestosSearch = require('../../../lib/sesasbestos.js');
var vincenty = require('../../../lib/vincenty.js');


console.log("Running inject script");

//if ops logs update
masterViewModel.notesViewModel.opsLogEntries.subscribe(lighthouseDictionary);

//if messages update
masterViewModel.messagesViewModel.messages.subscribe(lighthouseDictionary);

//if ops logs update
masterViewModel.notesViewModel.opsLogEntries.subscribe(function(){lighthouseMessageTPlus($('div[data-bind="foreach: opsLogEntries"] .text-muted:not([lhTPlus])'))});

//if messages update
masterViewModel.messagesViewModel.messages.subscribe(function(){lighthouseMessageTPlus($('div[data-bind="foreach: messages"] .text-muted:not([lhTPlus])'))});

// timeline updates
masterViewModel.jobHistory.subscribe(lighthouseTimeLineTPlus);


//if the ETA inputs are visable
masterViewModel.teamsViewModel.jobTeamStatusBeingUpdated.subscribe(lighthouseETA);

//if the ETA time changes
masterViewModel.teamsViewModel.jobTeamStatusEstimatedCompletion.subscribe(lighthouseETAFromNow);

//if tasking update

//Force the tasking function to last in the stack of subscribers for this.
//Prevents the UI redrawing AFTER the icons have been set, meaning they get removed
//https://stackoverflow.com/questions/779379/why-is-settimeoutfn-0-sometimes-useful
masterViewModel.teamsViewModel.taskedTeams.subscribe(function() {
  setTimeout(lighthouseTasking,0)
});

function lighthouseETAFromNow() {
  var future = moment(masterViewModel.teamsViewModel.jobTeamStatusEstimatedCompletion.peek())
  var now = moment()
  var totalHours = future.diff(now, 'hours');
  var totalMinutes = Math.ceil(future.diff(now, 'minutes'));
  var clearMinutes = Math.ceil(totalMinutes % 60);
  $('#quickETAtext').text("In "+totalHours + " hours and " + clearMinutes + " minutes")
}

function lighthouseETA() {
  setTimeout( function() {
    //dont draw for offsite
    if (masterViewModel.teamsViewModel.jobTeamStatusTypeBeingUpdated().Id != 5)
    {
    $('a[data-bind$="loadingButton: $parent.updatingJobTeamStatus, click: $parent.updateJobTeamStatus"]')
      .each(function(k,v){ //there can only be one, but why not handle more than one incase

        var buttons = return_quicketarow()
        var text = return_quicketamoment()

        $('div[data-bind$="validationElement: $parent.jobTeamStatusEstimatedCompletion"].input-group').after(text)


        $(buttons).find("#5min").click(function() {
            addToTime(5,v,text)
        })
        $(buttons).find("#10min").click(function() {
          addToTime(10,v,text)
        })
        $(buttons).find("#15min").click(function() {
          addToTime(15,v,text)
        })
        $(buttons).find("#30min").click(function() {
          addToTime(30,v,text)
        })
        $(buttons).find("#60min").click(function() {
          addToTime(60,v,text)
        })
        $(v).before(buttons)

      })

      function addToTime(addMins, where, text) {
        var timeInput = $(where).parent('div').parent('div').parent('div').find('input[data-bind$="datetimepicker: $parent.jobTeamStatusEstimatedCompletion, attr: {placeholder: $parent.jobTeamStatusTypeBeingUpdated() ? ($parent.jobTeamStatusTypeBeingUpdated().Id == Enum.JobTeamStatusType.Enroute.Id ? \'ETA\' : \'ETC\') : \'\' \}"]')
        var now = moment()
        var current = moment()
        if (timeInput.val() != ''){
          current = moment(timeInput.val(),'DD/MM/YYYY HH:mm')
        }
        var future = current.clone()
        future.add(addMins,'m')
        masterViewModel.teamsViewModel.jobTeamStatusEstimatedCompletion(future)
      }
}
}, 0);

}


function lighthouseTasking() {
    console.log("Tasking Changes, adding buttons where needed per team");
    ///Horrible nasty code for untasking

    $('a[data-bind="attr: {href: \'/Teams/\' + Team.Id + \'/Edit\'}, text: Team.Callsign"').each(function(k, v) { //for every dom that shows team name
        if ($(v).parent().find("#message").length == 0) { //check for an existing msg button
            DOMCallsign = ($(this)[0].href.split("/")[4])
            //for every tasked team
            $.each(masterViewModel.teamsViewModel.taskedTeams.peek(), function(k, vv) {
                //match against this DOM
                if (vv.Team.Id == DOMCallsign && vv.Team.Members.length)
                {
                    //attach a sms button
                    msg = return_message_button()
                    $(v).after(msg)

                    //click function
                    $(msg).click(function() {
                        event.stopImmediatePropagation();
                        var tightarray = []
                        vv.Team.Members.map(function(member) {
                            tightarray.push(member.Person.Id)
                        })
                        window.open('/Messages/Create?lhquickrecipient=' + escape(JSON.stringify(tightarray)), '_blank');
                    })
                }
            })
        } else {
          console.log('already has a sms button')
        }
    })

    $('div.widget-content div.list-group div.list-group-item.clearfix div.col-xs-6.small.text-right').each(function(k, v) { //for every team dom
        if ($(v).parent().find("#untask").length == 0) { //check for an existing untask button

            //pull out the call sign and the status
            DOMCallsign = ($(this)[0].parentNode.children[0].children[0].href.split("/")[4])
            DOMStatus = ($(this)[0].parentNode.children[1].innerText.split(" ")[0])
            //for every tasked team
            $.each(masterViewModel.teamsViewModel.taskedTeams.peek(), function(k, vv) {
                //match against this DOM
                if (vv.Team.Id == DOMCallsign && vv.CurrentStatus == DOMStatus && vv.CurrentStatusId == 1) //only show for tasking that can be deleted (tasked only)
                {
                    //attached a X button if its matched and deletable
                    untask = return_untask_button()
                    $(v).append(untask)

                    //click function
                    $(untask).click(function() {
                        event.stopImmediatePropagation();
                        untaskTeamFromJob(vv.Team.Id, jobId, vv.Id) //untask it
                    })
                }
            })
        } else {
          console.log('already has untask button')
        }
    })
}


//call on run
lighthouseDictionary();
//
lighthouseMessageTPlus($('div[data-bind="foreach: messages"] .text-muted:not([lhTPlus])'))
lighthouseMessageTPlus($('div[data-bind="foreach: opsLogEntries"] .text-muted:not([lhTPlus])'))
lighthouseTimeLineTPlus();

//call when the address exists
whenAddressIsReady(function() {
  whenUrlIsReady(function() {
    if(typeof masterViewModel.geocodedAddress.peek() == 'undefined')
    {
      $('#asbestos-register-text').html("Not A Searchable Address");
    } else if (masterViewModel.geocodedAddress.peek().Street == null || masterViewModel.geocodedAddress.peek().StreetNumber == null)
    {
      $('#asbestos-register-text').html("Not A Searchable Address");
    } else {
      sesAsbestosSearch(masterViewModel.geocodedAddress.peek(), function(res) { //check the ses asbestos register first
        if (res == true)
        { //tell the inject page (rendering result handled on the inject page)
          window.postMessage({ type: "FROM_PAGE_SESASBESTOS_RESULT", address: masterViewModel.geocodedAddress.peek(), result: true, color: 'red' }, "*");
        } else { //otherwise check the fair trade database via background script
            window.postMessage({ type: "FROM_PAGE_FTASBESTOS_SEARCH", address: masterViewModel.geocodedAddress.peek() }, "*");
          }
      });
    }
    if(typeof masterViewModel.geocodedAddress.peek() != 'undefined')
    {
     if (masterViewModel.geocodedAddress.peek().Latitude != null || masterViewModel.geocodedAddress.peek().Longitude != null) {
       window.postMessage({ type: "FROM_PAGE_LHQ_DISTANCE", lat: masterViewModel.geocodedAddress.peek().Latitude, lng: masterViewModel.geocodedAddress.peek().Longitude }, "*");

        if (masterViewModel.jobType.peek().ParentId == 5) { //Is a rescue
          var t0 = performance.now();
          let avlType = masterViewModel.jobType.peek().Name
          switch(avlType) { //translations for different AVL names
            case "RCR":
            avlType = "GLR"
            break
          }
        $.ajax({
    type: 'GET'
    , url: urls.Base+'/Api/v1/ResourceLocations/GET?resourceTypes='+avlType
    , beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    }
    , cache: false
    , dataType: 'json'
    , data: {LighthouseFunction: 'NearestAVL', userId: user.Id}
    , complete: function(response, textStatus) {
      if (textStatus == 'success')
      {
       avlDistances = []
       response.responseJSON.forEach(function(v){
            v.distance = vincenty.distVincenty(v.Latitude,v.Longtitude,masterViewModel.geocodedAddress.peek().Latitude,masterViewModel.geocodedAddress.peek().Longitude)/1000
            avlDistances.push(v)
          })
       let _sortedAvlDistances = avlDistances.sort(function(a, b) {
            return a.distance - b.distance
          });
          $('#nearest-avl-text').text('')
       if (_sortedAvlDistances.length > 0) {
         var maxLength = 3 //how many results to display
         var used = 0
         _sortedAvlDistances.forEach(function(v) { //safe way to loop with a limit
           if (used < maxLength) {
             used++
           $('#nearest-avl-text').text($('#nearest-avl-text').text() + `${v.CallSign} (${v.distance.toFixed(2)} kms), `)
         }
         })
         $('#nearest-avl-text').text($('#nearest-avl-text').text().slice(0,-2)) //trim the comma space from the very end
       } else {
        $('#nearest-avl-text').text("No AVL results returned for "+avlType)
       }
       var t1 = performance.now();
       console.log("Call to calculate distances from AVLs took " + (t1 - t0) + " milliseconds.")
      }
    }
  });
  } else {
         $('#nearest-avl-text').text('Enabled only for rescue jobs')
  }
     } else {
     $('#nearest-lhq-text').text('No geocoded job location available')
     $('#nearest-avl-text').text('No geocoded job location available')
   }
   } else {
     $('#nearest-lhq-text').text('No geocoded job location available')
     $('#nearest-avl-text').text('No geocoded job location available')
   }
  })



  //
  //postcode checking code
  //

  var lastChar = masterViewModel.geocodedAddress.peek().PrettyAddress.substr(masterViewModel.geocodedAddress.peek().PrettyAddress.length - 4)

  if (masterViewModel.geocodedAddress.peek().PostCode == null && (isNaN(parseInt(lastChar)) == true)) //if no postcode is displayed
  {
    postCodes.returnPostCode(masterViewModel.geocodedAddress.peek().Locality, function(postcode){
      if (typeof postcode !== 'undefined')
      {
        $('p[data-bind="text: enteredAddress"]').text($('p[data-bind="text: enteredAddress"]').text()+", "+postcode)
      } else {
        console.log("Postcode not found")
      }
    });

  } else if (masterViewModel.geocodedAddress.peek().PostCode != null && (isNaN(parseInt(lastChar)) == true)) {
    console.log('postcode is in the geocode by not displayed')
    $('p[data-bind="text: enteredAddress"]').text($('p[data-bind="text: enteredAddress"]').text()+", "+masterViewModel.geocodedAddress.peek().PostCode)
  }

  //end postcode

})

quickTask = return_quicktaskbutton();
quickSector = return_quicksectorbutton();
quickCategory = return_quickcategorybutton();
quickRadioLog = return_quickradiologbutton();
instantRadiologModal = return_quickradiologmodal();


//the quicktask button
$(quickTask).find('button').click(function() {
  if ($(quickTask).hasClass("open") == false)
  {
    InstantTaskButton()
  }
});

//the quicksector button
$(quickSector).find('button').click(function() {
  if ($(quickSector).hasClass("open") == false)
  {
    InstantSectorButton()
  }
});

//the quickcategory button
$(quickCategory).find('button').click(function() {
  if ($(quickCategory).hasClass("open") == false)
  {
    InstantCategoryButton()
  }
});


//add the radio log modal
$( "body" ).append(instantRadiologModal);

//the quick radio log button
$(quickRadioLog).find('button').click(function() {

  if (masterViewModel.teamsViewModel.taskedTeams.peek().length == 1 && $('#instantRadioLogCallSign').val() == '') {
    $('#instantRadioLogCallSign').val(masterViewModel.teamsViewModel.taskedTeams.peek()[0].Team.Callsign)
  }

  $('#instantradiologModal').modal()
});

// submit radio log on enter press in message body
$('#instantRadioLogText').keydown(function(event) {
    if (event.keyCode == 13) {
        processSubmitInstantRadioLog()
        return false;
     }
   })

//submit radio log on submit button press
$(instantRadiologModal).find('#submitInstantRadioLogButton').click(function() {
processSubmitInstantRadioLog()
});

//handle both the above submits
function processSubmitInstantRadioLog() {
  if ($('#instantRadioLogText').val() == '') {
    $('#instantRadioLogTextForm').addClass('has-error')
  } else {
submitInstantRadioLog($('#instantRadioLogCallSign').val(),$('#instantRadioLogText').val(),function(result) {
  if (result) {
    $('#instantradiologModal').modal('hide')
    $('#instantRadioLogTextForm').removeClass('has-error') //just incase
    $('#instantRadioLogText').val('')
  } else {
    alert('Error submitting log entry')
  }
})
}
}


whenJobIsReady(function(){


  if (masterViewModel.canTask.peek() == true) //this role covers sectors and category as well
  {
    $('#lighthouse_actions_content').append(quickTask, quickSector, quickCategory);

  }

  $('#lighthouse_actions_content').append(quickRadioLog);

});


whenTeamsAreReady(function(){

  lighthouseTasking()

  //Bold the team action taken
  $('#content div.col-md-5 div[data-bind="text: ActionTaken"]').css("font-weight", "bold");

  //checkbox for hide completed tasking
  $('#content div.col-md-5 div[data-bind="visible: teamsLoaded()"] div.widget-header').append(renderCheckBox());

  if (masterViewModel.sector.peek() !== null)
  {
    console.log('sector filter enabled')
    $('#lighthouse_actions div.widget-header').append(renderSectorFilterCheckBox());

    $('#lighthouseSectorFilterEnabled').click(function() {
      // Toggle Value
      var lh_SectorFilterEnabled = !( localStorage.getItem('LighthouseSectorFilterEnabled') == 'true' || localStorage.getItem('LighthouseSectorFilterEnabled') == null );
      // Save Value
      localStorage.setItem('LighthouseSectorFilterEnabled', lh_SectorFilterEnabled);
      sectorfilter_switch();
    });
    sectorfilter_switch();
  }

  $('#lighthouseEnabled').click(function() {
    // Toggle Value
    var lh_hideComplete = !( localStorage.getItem('LighthouseHideCompletedEnabled') == 'true' || localStorage.getItem('LighthouseHideCompletedEnabled') == null );
    // Save Value
    localStorage.setItem('LighthouseHideCompletedEnabled', lh_hideComplete);
    // Trigger Display Change
    jobView_teamsTasked_completedHiddenSwitch();
  });

  jobView_teamsTasked_itemsPrepare();
});

function sectorfilter_switch(){
  // Set flag
  var lh_SectorFilterEnabled = localStorage.getItem('LighthouseSectorFilterEnabled') == 'false';
  // Toggle class for checkbox
  $('#lighthouseSectorFilterEnabled')
    .toggleClass('fa-check-square-o', lh_SectorFilterEnabled)
    .toggleClass('fa-square-o', !lh_SectorFilterEnabled);
}





/**
 * Job View - Tasked Teams - Loop through tasked teams and add CSS class related to Status
 */
function jobView_teamsTasked_itemsPrepare(){
  // Loop through all Tasked Teams
  $('div.widget > div.widget-content > div[data-bind$="taskedTeams"] > div')
    .each(function(k,v){
      var $t = $(v);
      var lastUpdate = $('span[data-bind^="text: CurrentStatus"]', $t).text();
      var b = false;
      // Strip Old Classes
      $t.attr('class', $t.attr('class').replace(/\bteamStatus_\S+\b/,' '));
      // Add new Class for Team Status
      if( b = /^(.+)\s+\(Logged:\s+([^\)]+)\)/.exec(lastUpdate) ){
        $t.addClass('teamStatus_'+b[1].replace(/\s+/,'-').toLowerCase());
      }else{
        console.log('Unable to parse '+lastUpdate);
      }
    });
  jobView_teamsTasked_completedHiddenSwitch();
}

/**
 * Job View - Show/Hide Teams based on whether Team Status is Completed an Option is On/Off
 */
function jobView_teamsTasked_completedHiddenSwitch(){
  // Set flag
  var hideComplete = localStorage.getItem('LighthouseHideCompletedEnabled') == 'false';
  // Toggle Visibility of Tasked Teams
  // Non-Completed Crews
  $('div.widget > div.widget-content > div[data-bind$="taskedTeams"] > div:not(.teamStatus_complete) > div.row:not(:first-child)').show();
  // Completed Crews
  $('div.widget > div.widget-content > div[data-bind$="taskedTeams"] > div.teamStatus_complete > div.row:not(:first-child)').toggle(!hideComplete);
  // Toggle class for checkbox
  $('#lighthouseEnabled')
    .toggleClass('fa-check-square-o', hideComplete)
    .toggleClass('fa-square-o', !hideComplete);
}

/**
 * Job View - Toggle Visibility of Job
 */
function jobView_teamsTasked_showHiddenItem(e){
  // Tasked Team Clicked On
  var $t = $(e.currentTarget);
  // Only Toggle Content if the Clicked Team is Complete
  if( $t.hasClass('teamStatus_complete') )
    $t.children('div.row:gt(0)').stop(true).slideToggle();
}

/**
 * Subscribe to Tasked Team List - Reprocess list on change
 */
masterViewModel.teamsViewModel.taskedTeams.subscribe(jobView_teamsTasked_itemsPrepare);

/**
 * Attach Function to toggle Team Visibility on Click
 */
$(document).on('click',  'div.widget > div.widget-content > div[data-bind$="taskedTeams"] > div', jobView_teamsTasked_showHiddenItem);



document.title = "#"+jobId;


function lighthouseTimeLineTPlus() {
  //messages can load before job created time has loaded
  whenJobIsReady(function(){
    let jobCreatedMoment = moment(masterViewModel.jobReceived())
    $('div[data-bind="foreach: jobHistory"] small[data-bind="text: moment(TimeStamp).format(utility.dtFormat)"]').each(function (r) {
      // weird race condition where they already have the attrib
      if ($(this).attr('lhTPlus') === undefined || $(this).attr('lhTPlus') === false) {
        let res = $(this).text()
        let tPlusText = returnTTime(res)
        $(this).attr('lhTPlus',tPlusText)
        $(this).text($(this).text().replace(res,`${res} (${tPlusText})`))
      }
    })
    console.log("lighthouseTimeLineTPlus Done calculating Tplus times")
  })
}

function lighthouseMessageTPlus(dom) {
  //messages can load before job created time has loaded
  whenJobIsReady(function(){
    dom.each(function (r) {
      // weird race condition where they already have the attrib
      if ($(this).attr('lhTPlus') === undefined || $(this).attr('lhTPlus') === false) {
        let res = $(this).text().match(/^(?:Received|Created) (?:at|on) (.+) by (.+)$/);
        if (res && res.length) {
          let tPlusText = returnTTime(res[1])
          $(this).attr('lhTPlus',tPlusText)
          $(this).text($(this).text().replace(res[1],`${res[1]} (${tPlusText})`))
        }
      }
    })
    console.log("lighthouseMessageTPlus Done calculating Tplus times")
  })
}

function returnTTime(messageDate) {
  let jobCreatedMoment = moment(masterViewModel.jobReceived())
  let end = moment(messageDate,'DD/MM/YYYY HH:mm')
  jobCreatedMoment.seconds(0) //zero the seconds because the log doesnt show seconds
  //work out if its T+ or T-
  let whichFirst = jobCreatedMoment.isBefore(end)
  let tPlus = moment.duration(end.diff(jobCreatedMoment));
  let years = whichFirst ? tPlus.years() : tPlus.years() * -1,
  days = whichFirst ? tPlus.days() : tPlus.days() * -1,
  hrs = whichFirst ? tPlus.hours() : tPlus.hours() * -1,
  hrsTotal = hrs + (24 * days),  //wont use days so make hours include days
  mins = whichFirst ? tPlus.minutes() : tPlus.minutes() * -1,
  secs = whichFirst ? tPlus.seconds() : tPlus.seconds() * -1,
  symbol = whichFirst ? '+' : '-'
  let tPlusText = `T${symbol}${pad(hrs)}:${pad(mins)}:${pad(secs)}`
  return tPlusText
}

function lighthouseDictionary(){

  var $targetElements = $('.job-details-page div[data-bind="foreach: opsLogEntries"] div[data-bind="text: $data"]');

  var ICEMS_Dictionary = {
    'ASNSW'   : 'NSW Ambulance' ,
    'FRNSW'   : 'NSW Fire &amp; Rescue' ,
    'NSWPF'   : 'NSW Police Force' ,
    'TMC'     : 'Transport Management Center',
    'NSWTMC'  : 'NSW Transport Management Center',

    'AA'      : 'As Above' ,
    'INFTS?'  : 'Informant/Caller' ,
    '\dPOBS?' : 'Person(s) On Board' ,
    'POIS?'   : 'Person(s) Of Interest' ,
    'POSS'    : 'Possible' ,
    'PTS?'    : 'Patient(s)' ,
    'VEHS?'   : 'Vehicle(s)' ,
    'VICT?'   : 'Victim' ,
    'Y[OR]'   : 'Years Old',
    'NPI'     : 'No Person(s) Injured',
    'NPT'     : 'No Person(s) Trapped',
    'NFI'     : 'No Further Information',
    'THX'     : 'Thanks',
    'NESB'    : 'Non-English Speaking Background',
    'YOM'     : 'Year Old Male',
    'YOF'     : 'Year Old Female'
  };

  $targetElements.each(function(v){
    var $t = $(this);
    var contentOrig = $t.html();
    var contentRepl = contentOrig;
    // '<br>' to HTML LineBreaks
    contentRepl = contentRepl.replace(/&lt;br(?:\s*\/)?&gt;/g, '<br />');
    // '\n' to HTML LineBreaks
    contentRepl = contentRepl.replace(/\s*\\n/, '<br />');
    // ICEMS Dictionary
    _.each(ICEMS_Dictionary, function(clearText, abbrText){
      var contentTemp = contentRepl;
      contentRepl = contentRepl.replace(new RegExp('\\b(' + abbrText + ')\\b', 'gi'), '<abbr title="' + clearText + '">$1</abbr>');
    });
    if(contentRepl != contentOrig){
      $t.html(contentRepl).addClass('lighthouseDictionary-modified');
    }else{
      $t.addClass('lighthouseDictionary-nomodifications');
    }
  });

}

if (document.getElementById("FinaliseQuickTextBox")) {
  document.getElementById("FinaliseQuickTextBox").onchange = function() {
    var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");
    masterViewModel.finalisationText(this.value);
  }
}

if (document.getElementById("CompleteQuickTextBox")) {
  document.getElementById("CompleteQuickTextBox").onchange = function() {
    var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");
    masterViewModel.finalisationText(this.value);
  }
}


masterViewModel.completeTeamViewModel.primaryActivity.subscribe(function(newValue) {
  if (typeof newValue !== 'undefined') {
    if (newValue !== null) {
      switch (newValue.Name) {
        case "Storm":
        removeOptions(document.getElementById("CompleteTeamQuickTextBox"));
        var quickText = ["", "No damage to property, scene safe. Resident to arrange for clean up.", "Tree removed and scene made safe.", "Roof repaired and scene made safe.", "Damage repaired and scene made safe.", "Job was referred to contractors who have completed the task.", "Council have removed the tree from the road, scene made safe.", "Branch/tree sectioned; resident/owner to organize removal"]
        document.getElementById("CompleteTeamQuickTextBox").removed
        for (var i = 0; i < quickText.length; i++) {
          var opt = document.createElement('option');
          opt.text = quickText[i];
          opt.value = quickText[i];
          document.getElementById("CompleteTeamQuickTextBox").add(opt);
        }
        break;
        case "Search":
        removeOptions(document.getElementById("CompleteTeamQuickTextBox"));
        var quickText = ["", "All teams complete on search, person found safe and well.", "All teams complete on search, nothing found."]
        for (var i = 0; i < quickText.length; i++) {
          var opt = document.createElement('option');
          opt.text = quickText[i];
          opt.value = quickText[i];
          document.getElementById("CompleteTeamQuickTextBox").add(opt);
        }
        break;
      }
    }
  }
});


function InstantCategoryButton() {
  if ( $(quickCategory).find('li').length < 1 ) {
    var categories = ["NA", "1", "2", "3", "4", "5"];
    finalli = []
    categories.forEach(function(entry) {
      item = (<li><a style="text-align:left" href="#">{entry}</a></li>);
      //click handler
      $(item).click(function (e) {
        SetCategory(entry)
        e.preventDefault();
      })
      finalli.push(item)
    })
    $(quickCategory).find('ul').append(finalli)
  }

  function SetCategory(id) {
    if (id == 'NA')
    {
      id = 0
    } else {
      id = parseInt(id)
    }
    $.ajax({
      type: 'POST'
      , url: urls.Base+'/Api/v1/Jobs/BulkCategorise'
      , beforeSend: function(n) {
        n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
      }
      , data: {Id: id, Ids: [jobId], LighthouseFunction: 'SetCategory', userId: user.Id}
      , cache: false
      , dataType: 'json'
      , complete: function(response, textStatus) {
        if (response.status == 204)
        {
        masterViewModel.JobManager.GetHistory(jobId,function(t){masterViewModel.jobHistory(t)}) //load job history
        masterViewModel.JobManager.GetJobById(jobId,Enum.JobViewModelType.Full.Id,function(t){masterViewModel.jobStatus(t.JobStatusType)}) //update status
      }
    }
  })
  }

}

function InstantSectorButton() {

  $(quickSector).find('ul').empty();
  var loading = (<li><a href="#" style="text-align: center;"><i class="fa fa-refresh fa-spin fa-2x fa-fw"></i></a></li>)
  $(quickSector).find('ul').append(loading)

  //fetch the job and check its tasking status to ensure the data is fresh and not stale on page.
  $.ajax({
    type: 'GET'
    , url: urls.Base+'/Api/v1/Sectors/Search?entityIds[]='+user.currentHqId+'&statusIds=1&viewModelType=2&pageSize=100&pageIndex=1'
    , beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    }
    , cache: false
    , dataType: 'json'
    , data: {LighthouseFunction: 'InstantSectorButton', userId: user.Id}
    , complete: function(response, textStatus) {
      if (textStatus == 'success')
      {
        if(response.responseJSON.Results.length) {
          $(quickSector).find('ul').empty();

          var data = response.responseJSON

          finalli = []
          data.Results.forEach(function(entry) {
            if (masterViewModel.sector.peek() != null)
            {
              currentsector = masterViewModel.sector.peek().Id
            } else {
              currentsector = null
            }
            if (entry.Id != currentsector) //if its not the same as the current sector
            {
              item = (<li><a style="text-align:left" href="#">{entry.Name}</a></li>);
            } else { //if it is the same, make it bold.
              item = (<li><a style="text-align:left" href="#"><b>{entry.Name}</b></a></li>);
            }
            $(item).click(function (e) {
              SetSector(entry,currentsector)
              location.reload();
              //e.preventDefault();
            })
            finalli.push(item)
          })
          $(quickSector).find('ul').append(finalli)
        } else {
          $(quickSector).find('ul').empty();
          no_results = (<li><a href="#">No Open Sectors</a></li>)
          $(quickSector).find('ul').append(no_results)
        }
      }
    }
  });

  function SetSector(sector,currentsector) {
    if (sector.Id != currentsector) //if its not the same as the current sector
    {
      $.ajax({
        type: 'PUT'
        , url: urls.Base+'/Api/v1/Sectors/'+sector.Id+'/Jobs'
        , beforeSend: function(n) {
          n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
        }
        , data: {IdsToAdd: [jobId], LighthouseFunction: 'SetSector', userId: user.Id}
        , cache: false
        , dataType: 'json'
        , complete: function(response, textStatus) {
          if (response.status == 200)
          {
            masterViewModel.JobManager.GetHistory(jobId,function(t){masterViewModel.jobHistory(t)}) //load job history
            masterViewModel.JobManager.GetJobById(jobId,Enum.JobViewModelType.Full.Id,function(t){masterViewModel.sector(t.Sector)}) //update status
          }
        }
      });
    } else { //if its the same, then remove it.
      $.ajax({
        type: 'PUT'
        , url: urls.Base+'/Api/v1/Sectors/RemoveJobFromSector/'+jobId
        , beforeSend: function(n) {
          n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
        }
        , data: {LighthouseFunction: 'SetSector', userId: user.Id}
        , cache: false
        , dataType: 'json'
        , complete: function(response, textStatus) {
          if (response.status == 200)
          {
            masterViewModel.JobManager.GetHistory(jobId,function(t){masterViewModel.jobHistory(t)}) //load job history
            masterViewModel.JobManager.GetJobById(jobId,Enum.JobViewModelType.Full.Id,function(t){masterViewModel.sector(t.Sector)}) //update status
          }
        }
      });
    }
  }
}

////Quick Task Stuff
function InstantTaskButton() {

  var alreadyTasked = []
  $.each(masterViewModel.teamsViewModel.taskedTeams.peek(), function(k,v){

    if(v.CurrentStatusId != 6 && v.CurrentStatusId != 7)
    {
      alreadyTasked.push(v.Team.Id);
    }
  });

  $(quickTask).find('ul').empty();
  var loading = (<li><a href="#" style="text-align: center;"><i class="fa fa-refresh fa-spin fa-2x fa-fw"></i></a></li>);
  $(quickTask).find('ul').append(loading);

  lh_SectorFilterEnabled = !( localStorage.getItem('LighthouseSectorFilterEnabled') == 'true' || localStorage.getItem('LighthouseSectorFilterEnabled') == null );

  var sectorFilter = null;
  if (masterViewModel.sector.peek() !== null && lh_SectorFilterEnabled === true )
  {
    sectorFilter = masterViewModel.sector.peek().Id
  }

  console.log("Sector Filter is:"+sectorFilter)

  //fetch the job and check its tasking status to ensure the data is fresh and not stale on page.
  $.ajax({
    type: 'GET'
    , url: urls.Base+'/Api/v1/Jobs/'+jobId+'?viewModelType=2'
    , beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    }
    , cache: false
    , dataType: 'json'
    , data: {LighthouseFunction: 'QuickTaskGetJob', userId: user.Id}
    , complete: function(response, textStatus) {

      if (textStatus == 'success')
      {
        var data = response.responseJSON

        if (data.JobStatusType.Id == 1 || data.JobStatusType.Id == 2 || data.JobStatusType.Id == 4 || data.JobStatusType.Id == 5) //New or Active or Tasked or Refered
        {

          ReturnTeamsActiveAtLHQ(user.hq,sectorFilter,function(response){

            if(response.responseJSON.Results.length) {
              $(quickTask).find('ul').empty();

              /////
              ///// Search Box
              /////
              theSearch = return_search_box();
              $(theSearch).click(function (e) {
                e.stopPropagation();
              });

              $(theSearch).keyup(function (e) {
                e.stopPropagation();
                $.each($(quickTask).find('ul').find('li[role!="presentation"]'),function(k,v){
                  if (($(v)[0].innerText).toUpperCase().indexOf(e.target.value.toUpperCase()) == -1)
                  {
                    $(v).hide()
                  } else {
                    $(v).show()
                  }
                });
                $.each($(quickTask).find('ul').find('li[role="presentation"]'),function(k,v){
                  childrenVis = false
                  nextChild = $(v).next()
                  // walk the neighbours of the li, if they are displayed then dont hide the pres li, otherwise hide it. wish this was a nested DOM!
                  while (nextChild != null)
                  {
                    if ($(nextChild).css('display') != undefined) //next might not be a valid dom, cause next seems to keep going when there is no next!
                    {
                      if ( $(nextChild).css('display') != 'none'){ //if hidden
                        childrenVis = true
                      }
                    }
                    if ($(nextChild).length == 0 || $(nextChild).next().attr('role') == 'presentation') //if this is a valid dom, and the next one isnt pres. next wont ever stop and will just return a 0 lenght
                    {
                      nextChild = null
                    } else {
                      nextChild = $(nextChild).next()
                    }
                  }
                  if (childrenVis != true) //hide or show the pres depending on its children
                  {
                    $(v).hide()
                  } else {
                    $(v).show()
                  }
                });
              });
              /////
              ///// END Search Box
              /////
              $(quickTask).find('ul').append(theSearch);

              sector = {}
              nonsector = []
              $.each(response.responseJSON.Results, function(k, v) { //for every team that came back
                if ($.inArray(v.Id,alreadyTasked) == -1) //not a currently active team on this job, so we can task them
                {
                  var item = null;
                  if (v.Members.length == 0)
                  {
                    item = return_li(v.Id,v.Callsign.toUpperCase(),null,v.TaskedJobCount+"");
                  } else {
                    $(v.Members).each(function(k, vv) {
                      if (vv.TeamLeader)
                      {
                        item = return_li(v.Id,v.Callsign.toUpperCase(),vv.Person.FirstName+" "+vv.Person.LastName,v.TaskedJobCount+"");
                      }
                    });
                  }
                  //still create teams that have no TL
                  if (item === null) {
                    item = return_li(v.Id,v.Callsign.toUpperCase(),"No TL",v.TaskedJobCount+"");
                  }

                  if (v.Sector === null)
                  {
                    nonsector.push(item)
                  } else {
                    var sectorName = v.Sector.Name;
                    if (sectorName in sector)
                    {
                      sector[sectorName].push(item)
                    } else {
                      sector[sectorName] = [item]
                    }
                  }

                  //click handler
                  $(item).click(function (e) {
                    TaskTeam(v.Id)
                    e.preventDefault();
                  })

                }
              });

              finalli = [];
              drawnsectors = [];

              //finalli.push(return_lipres(masterViewModel.sector.peek().Name+" Sector Teams"));
              $.each(sector, function(k, v){
                if (k in drawnsectors)
                {
                  finalli.push(v);
                } else {
                  drawnsectors.push(k);
                  //if (finalli.length != 0) { finalli.push(return_lidivider()) };
                  finalli.push(return_lipres(k+ " Sector"))
                  finalli.push($(v))
                }
              });
              if (nonsector.length) {
              //finalli.push(return_lidivider());
              finalli.push(return_lipres("Unsectorised Teams"));
              $.each(nonsector, function(k, v){
                finalli.push(v);
              })
            }
              $(quickTask).find('ul').append(finalli);

            } else {
              $(quickTask).find('ul').empty();
              no_results = (<li><a href="#">No Active Field Teams</a></li>);
              $(quickTask).find('ul').append(no_results);
            }

          });

        } else { //job has changed status since it was opened so warn them
          $(quickTask).find('ul').empty();
          no_results = (<li><a href="#">Cannot task when job status is {masterViewModel.jobStatus.peek().Name}. Refresh the page!</a></li>)
          $(quickTask).find('ul').append(no_results)
        }
      }
    }
  });

}

////Instant radio log stuff
function submitInstantRadioLog(subject, text,cb) {
  masterViewModel.notesViewModel.OperationsLogManager.CreateEntry(jobId, null, null, subject || "Instant Radio Log", text, null, null, null, !1, !1, false, [15,6], null, function(res) {
if (res) {
      masterViewModel.notesViewModel.loadOpsLogPage()
      cb(true)
    } else {
      cb(false)
    }
})

}


function TaskTeam(teamID) {
  var data = {};
  var TeamIds = [];
  TeamIds.push(teamID);
  var JobIds = [];
  JobIds.push(jobId);


  $.ajax({
    type: 'POST'
    , url: urls.Base+'/Api/v1/Tasking'
    , beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    }
    , data: JSON.stringify({TeamIds:TeamIds, JobIds:JobIds, LighthouseFunction: 'TaskTeam', userId: user.Id})
    , cache: false
    , dataType: "json"
    , contentType: "application/json; charset=utf-8"
    , complete: function(response, textStatus) {
      if (textStatus == 'success' || textStatus == 'error') //work around for beacon bug returning error 500 for no reason
      {
        masterViewModel.teamsViewModel.loadTaskedTeams() //load teams
        masterViewModel.JobManager.GetHistory(jobId,function(t){masterViewModel.jobHistory(t)}) //load job history
        masterViewModel.JobManager.GetJobById(jobId,Enum.JobViewModelType.Full.Id,function(t){masterViewModel.jobStatus(t.JobStatusType)}) //update status
      }
    }
  });
}

function return_search_box() {
  return (
    <input type="text" style="width: 95%; margin:auto" id="filterquicksearch" maxlength="30" class="form-control input-sm" placeholder="Filter"></input>
  );
}

function return_li(id, callsign, teamleader, JobCount) {
  if (teamleader != null)
  {
    return(
      <li><a style="text-align:left" href="#"><b>{callsign}</b> - <small>{teamleader}<sup>TL</sup></small></a></li>
    );
  } else {
    return(
      <li><a style="text-align:left" href="#"><b>{callsign}</b> - <i><small>No Members</small></i></a></li>
    );
  }
}

function return_lipres(title) {
  return(
    <li style="text-align:left" role="presentation" class="dropdown-header">{title}</li>
  );
}

function return_lidivider() {
  return(
    <li role="presentation" class="divider"></li>
  );
}

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, 'g'), replace);
}

function removeOptions(selectbox) {
  for (var i = selectbox.options.length - 1; i >= 0; i--) {
    selectbox.remove(i);
  }
}

//take the clicked list option and set the complete action the value of this.
document.getElementById("CompleteTeamQuickTextBox").onchange = function() {
  var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");
  masterViewModel.completeTeamViewModel.actionTaken(this.value);
}

function return_untask_button() {
  return (<span id="untask" class="close" style="
    margin-right: -12px;
    margin-top: -12px;
    margin-left: 10px;
    ">×</span>);
}
function return_message_button() {
  return (<span id="message" class="close fa fa-envelope" style="
    margin-left: 5px;
    float: none !important;
    "></span>);
}



$(document).ready(function() {

  _.each([
      ["#stormtree", "Storm", "Tree Operations/Removal"],
      ["#stormproperty", "Storm", "Property Protection"],
      ["#stormsafety", "Storm", "Public Safety"],
      ["#stormaccess", "Storm", "Road/Access Clearance"],
      ["#stormrecon", "Storm", "Reconnaissance"],
      ["#rcrcalloff", "RoadCrashRescue", "Call Off"],
      ["#rcrcallextricate", "RoadCrashRescue", "Extrication "],
    ], function(args) {
      var selector = args[0]
      , parent = args[1]
      , child = args[2];

      $(args[0]).click(function() {
        masterViewModel.completeTeamViewModel.availablePrimaryActivities.peek().forEach(function(d){
          if (d.Name == parent) {
            masterViewModel.completeTeamViewModel.primaryActivity(d);
            masterViewModel.completeTeamViewModel.availablePrimaryTasks.subscribe(function(d) {
              d.forEach(function(d) {
                if (d.Name == child) {
                  masterViewModel.completeTeamViewModel.primaryTask(d)
                }
              });
            })
          }
        });
      });
    });
});

function return_quicktaskbutton() {
  return (
    <div id="lighthouse_instanttask" style="position:relative;display:inline-block;vertical-align:middle;padding-left:3px;padding-right:3px;" class="dropdown">
      <button class="btn btn-sm btn-warning dropdown-toggle" type="button" data-toggle="dropdown" id="lhtaskbutton"><i class="fa fa-tasks"></i>Instant Task
      <span class="caret"></span></button>
      <ul class="dropdown-menu scrollable-menu">
      </ul>
    </div>
  );
}

function return_quicksectorbutton() {
  return (
    <div id="lighthouse_instantsector" style="position:relative;display:inline-block;vertical-align:middle;padding-left:3px;padding-right:3px;" class="dropdown">
      <button class="btn btn-sm btn-info dropdown-toggle" type="button" data-toggle="dropdown" id="lhsectorbutton"><i class="fa fa-cubes"></i>Instant Sector
      <span class="caret"></span></button>
      <ul class="dropdown-menu scrollable-menu">
      </ul>
    </div>
  );
}

function return_quickcategorybutton() {
  return (
    <div id="lighthouse_instantcategory" style="position:relative;display:inline-block;vertical-align:middle;padding-left:3px;padding-right:3px;" class="dropdown">
      <button class="btn btn-sm btn-default dropdown-toggle" type="button" data-toggle="dropdown" id="lhcategorybutton"><i class="fa fa-database"></i>Instant Category
      <span class="caret"></span></button>
      <ul class="dropdown-menu scrollable-menu">
      </ul>
    </div>
  );
}

function return_quickradiologbutton() {
  return (
    <div id="lighthouse_instantradiolog" style="position:relative;display:inline-block;vertical-align:middle;padding-left:3px;padding-right:3px;">
      <button class="btn btn-sm btn-default" style="background-color: #837947;border-color: #837947" type="button" id="lhinstantradiologbutton"><i class="fa fa-microphone"></i>Instant Radio Log
      </button>
    </div>
  );
}

function return_quickradiologmodal() {
  return (
    <div class="modal fade" id="instantradiologModal" role="dialog" style="display: none;">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
            <h4 class="modal-title"><i class="fa fa-microphone"></i> Instant Radio Log Entry | Job</h4>
          </div>
          <div class="modal-body">
          <div class="form-group" title="">
            <div class="row">
              <label class="col-md-4 col-lg-3 control-label">Callsign</label>
              <div class="col-md-8 col-lg-9">
                <textarea id="instantRadioLogCallSign" class="form-control" rows="1"></textarea>
              </div>
              <div title="">
              </div>
            </div>
          </div>
            <div class="form-group" title="" id="instantRadioLogTextForm">
              <div class="row">
                <label class="col-md-4 col-lg-3 control-label">Note</label>
                <div class="col-md-8 col-lg-9">
                  <textarea id="instantRadioLogText" class="form-control"></textarea>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-info" id="submitInstantRadioLogButton"><span class="button-text">Submit</span></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function return_quicketarow() {
  return (
      <div style="display: inline-block">
        <span id="5min" class="label tag tag-darkgreen tag-disabled">
          <span class="tag-text"><img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
          src={lighthouseUrl+"icons/lh.png"} />+5min</span>
        </span>
        <span id="10min" class="label tag tag-darkgreen tag-disabled">
          <span class="tag-text"><img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
          src={lighthouseUrl+"icons/lh.png"} />+10min</span>
        </span>
        <span id="15min" class="label tag tag-darkgreen tag-disabled">
          <span class="tag-text"><img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
          src={lighthouseUrl+"icons/lh.png"} />+15min</span>
        </span>
        <span id="30min" class="label tag tag-darkgreen tag-disabled">
          <span class="tag-text"><img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
          src={lighthouseUrl+"icons/lh.png"} />+30min</span>
        </span>
        <span id="60min" class="label tag tag-darkgreen tag-disabled">
          <span class="tag-text"><img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
          src={lighthouseUrl+"icons/lh.png"} />+60min</span>
        </span>
      </div>
  );
}

function return_quicketamoment() {
  return (
      <div style="padding-left: 5px" id="quickETAtext">
      </div>
  );
}

function checkAddressHistory(){
  var date_options = {
    year: "numeric",
    month: "2-digit",
    day: "numeric",
    hour12: false
  };

  var address = masterViewModel.geocodedAddress();
  if(typeof address == 'undefined') {
    // address not available yet (probably waiting for server to respond to
    // AJAX. Try again soon.
    setTimeout(checkAddressHistory, 500);
    return;
  }

  //dont allow searches if the job has not been geocoded
  if(address.Street == null && address.Locality == null && address.Latitude == null && address.Longitude== null) {
    return $('#job_view_history_container').empty().append(
      '<em>Unable to Perform Address Search. Address does not appear valid (Not Geocoded).<br/>' +
      ( masterViewModel.canEdit()
        ? '<a href="/Jobs/' + jobId + '/Edit' + '">Please edit the job and geocode the job location.</a>'
        : 'Have an authorised user edit the job and geocode the job location.' ) + '</em>'
      );
  }

  //addresses with only GPS
  if(address.Street == null && address.Locality == null) {
    return $('#job_view_history_container').empty().append(
      '<em>Unable to Perform Address Search. Address does not appear valid (Only GPS Lat/Long).<br/>' +
      'Please edit the job and geocode the job location.</em>'
      );
  }

  var q;
  if(address.Street == null && address.Locality == null) {
    // address without a street or address but still geocoded
    q = address.PrettyAddress;
  } else {
    q = address.Street + ', ' + address.Locality;
  }
  q = q.substring(0, 30);

  var start = moment();
  var now = new Date;
  var end = moment();
  end.subtract(1, 'y');

  $.ajax({
    type: 'GET'
    , url: urls.Base+'/Api/v1/Jobs/Search'
    , beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    }
    , data: {
      'Q':                    q.substring(0, 30)
      , 'StartDate':          end.toISOString()
      , 'EndDate':            start.toISOString()
      , 'ViewModelType':      2
      , 'PageIndex':          1
      , 'PageSize':           1000
      , 'SortField':          'JobReceived'
      , 'SortOrder':          'desc'
      , 'LighthouseFunction': 'checkAddressHistory'
      , 'userId':             user.Id
    }
    , cache: false
    , dataType: 'json'
    , complete: function(response, textStatus) {
      var $job_view_history_container = $('#job_view_history_container');
      switch(textStatus){
        case 'success':
        if(response.responseJSON.Results.length) {
          var history_rows = {
            'exact':     {
              title :       'Same Address' ,
              key :         'exact' ,
              always_show : true ,
              hide_old :    false ,
              has_old :     false ,
              jobs :        new Array()
            } ,
            'partial':   {
              title :       'Apartment, Townhouse or Battleaxe' ,
              key :         'partial' ,
              always_show : false ,
              hide_old :    false ,
              has_old :     false ,
              jobs :        new Array()
            } ,
            'neighbour': {
              title :       'Immediate Neighbours' ,
              key :         'neighbour' ,
              always_show : false ,
              hide_old :    false ,
              has_old :     false ,
              jobs :        new Array()
            } ,
            'street':    {
              title :       'Same Street' ,
              key :         'street' ,
              always_show : false ,
              hide_old :    true ,
              has_old :     false ,
              jobs :        new Array()
            }
          };
          status_groups = {
            'active' :    ['new', 'acknowledged', 'active', 'tasked', 'referred'] ,
            'complete' :  ['complete', 'finalised'] ,
            'cancelled' : ['cancelled', 'rejected']
          };

          if(address.StreetNumber != null){
            var re_StreetNumber_Parts = /^(?:(\d+)\D)?(\d+)\D*/;
            var jobAddress_StreetNumber_tmp = re_StreetNumber_Parts.exec(
              address.StreetNumber);
            var jobAddress_StreetNumber_Max = parseInt(
              jobAddress_StreetNumber_tmp[2], 10);
            var index = typeof jobAddress_StreetNumber_tmp[1] == 'undefined' ? 2 : 1;
            var jobAddress_StreetNumber_Min = parseInt(
              jobAddress_StreetNumber_tmp[index], 10);
          }
          $.each(response.responseJSON.Results, function(k, v) {
              // Job Group
              var result_group = 'street';

              // History Job is Current Job
              if(v.Id == jobId) return true;

              // Santitise and Pre-Process Job Details (for later display)
              // Job URL
              v.url = '/Jobs/'+v.Id;
              // Adjust the Job Recieved Time
              v.JobReceived = new Date(v.JobReceived);
              // Generate the Relative Time
              v.relativeTime = moment(v.JobReceived).fromNow();
              // Is the Job Older than 14 Days
              v.isold = ( v.JobReceived.getTime() < ( now.getTime() - 14 * 24 * 60 * 60 * 1000 ) );
              // Default value for Situation on Scene
              if(v.SituationOnScene == null) v.SituationOnScene = (<em>View job for more detail</em>);
              // Job Tags
              var tagArray = new Array();
              $.each( v.Tags , function( tagIdx , tagObj ){
                tagArray.push( tagObj.Name );
              });
              v.tagString = ( tagArray.length ? tagArray.join(', ') : (<em>No Tags</em>) );
              // Job CSS Classes
              v.cssClasses = 'job_view_history_item job_view_history_item_status_' + v.JobStatusType.Name.toLowerCase();
              var jobGroups = new Array();
              $.each(status_groups, function(status_group, statuses) {
                if(statuses.indexOf(v.JobStatusType.Name.toLowerCase()) >= 0)
                  jobGroups.push(status_group);
              });
              if(jobGroups.length) v.cssClasses += ' job_view_history_item_statusgroup_' + jobGroups.join(' job_view_history_item_statusgroup_');
              if(v.isold) {
                v.cssClasses += ' job_view_history_item_old';
                if(jobGroups.indexOf('active') == -1) {
                  v.cssClasses += ' job_view_history_item_toggle';
                }
              }

              // Unless we have a Street Number for Current and Historic, we can only match the street
              if(v.Address.StreetNumber != null && address.StreetNumber != null) {

                if(v.Address.PrettyAddress == address.PrettyAddress) {
                  // Perfect Match
                  result_group = 'exact';
                } else if(v.Address.StreetNumber.replace(/\D+/g, '') == address.StreetNumber.replace(/\D+/g, '')){
                  // Not an exact address match, so include the address in the result row
                  result_group = 'partial';
                } else {
                  var rowAddress_StreetNumber_tmp = re_StreetNumber_Parts.exec(
                    v.Address.StreetNumber);
                  var rowAddress_StreetNumber_Max = parseInt(
                    rowAddress_StreetNumber_tmp[2], 10);
                  var index = typeof rowAddress_StreetNumber_tmp[1] == 'undefined' ? 2 : 1;
                  var rowAddress_StreetNumber_Min = parseInt(
                    rowAddress_StreetNumber_tmp[index], 10);
                  if (Math.abs(jobAddress_StreetNumber_Min - rowAddress_StreetNumber_Max) == 2 ||
                    Math.abs(jobAddress_StreetNumber_Max - rowAddress_StreetNumber_Min) == 2) {
                    result_group = 'neighbour';
                }
              }

            }

              // Push Job to Job Array
              history_rows[result_group].jobs.push(v);
              if(v.isold) history_rows[result_group].has_old = true;
            }); // Loop End - response.responseJSON.Results

            // Use JSX to Render
            $job_view_history_container.html(
              <div>
              {_.map(_.filter(history_rows, function(row) { return row.always_show || row.jobs.length; }), function(groupData, groupKey){
                return (
                  <fieldset id={"job_view_history_group_" + groupData.key } class={"job_view_history_group col-md-12" + (groupData.hide_old ? " job_view_history_showtoggle" : "")}>
                  <legend>
                  {groupData.title}
                  <span class="group_size">{groupData.jobs.length + ' Job' + (groupData.jobs.length == 1 ? '' : 's')}</span>
                  </legend>
                  <div class="form-group col-xs-12">
                  {(groupData.jobs.length == 0
                    ? <div class="job_view_history_none"><em>No Jobs Found</em></div>
                    : _.map(groupData.jobs, function(j){
                      return (
                        <div class={j.cssClasses}>
                        <div class="job_view_history_title">
                        <a href={j.url} class="job_view_history_id">{j.Identifier}</a>
                        <span class="job_view_history_address">{j.Address.PrettyAddress}</span>
                        <span class="job_view_history_status">{j.JobStatusType.Name}</span>
                        </div>
                        <div class="job_view_history_situation">{j.SituationOnScene}</div>
                        <div class="job_view_history_tags">
                        <i class="fa fa-tags"></i>
                        {j.tagString}
                        </div>
                        <div class="job_view_history_time">{j.relativeTime}</div>
                        </div>
                        );
                    })
                    )}
                  </div>
                  </fieldset>
                );
              })}
              </div>
            );

            // Show/Hide Handler
            var $job_view_history_toggle_old = $( <div class="job_view_history_toggle_old"><span>Show</span> Older Jobs</div> )
            .click(function() {
              var $t = $(this);
              var $p = $t.closest('fieldset.job_view_history_group');
              var $old_rows = $('div.job_view_history_item_toggle', $p);
              var toshow = $old_rows.filter(':hidden').length > 0;
              $old_rows.toggle(toshow);
              $('span', $t).text(toshow ? 'Hide' : 'Show');
            });
            $('fieldset.job_view_history_showtoggle')
            .each(function(k ,v){
              var $v = $(v);
              if($('div.job_view_history_item_toggle', $v).length){
                $('div.form-group', $v).append($job_view_history_toggle_old);
              }
            });

            // We've Inserted the History - Stop Here
            return;
          }
          content = '<em>Address Search - No History</em>';
          break;
          case 'error' :
          content = '<em>Unable to Perform Address Search</em>';
          break;
          case 'nocontent' :
          content = '<em>Address Search returned Unexpected Data</em>';
          break;
          case 'timeout' :
          content = '<em>Address Search Timed Out</em>';
          break;
          case 'abort' :
          content = '<em>Address Search Aborted</em>';
          break;
          case 'parsererror' :
          content = '<em>Address Search returned Unexpected Data</em>';
          break;
        }

      // Showing an Error Message
      $job_view_history_container.html(content);
    }
  });
}

setTimeout(checkAddressHistory, 400);

// wait for teams to have loaded
function whenTeamsAreReady(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
    if (typeof masterViewModel != "undefined" & masterViewModel.teamsViewModel.teamsLoaded.peek() == true) {
      console.log("teams are ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }, 200);
}

// wait for address to have loaded
function whenAddressIsReady(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
    if (typeof masterViewModel !== "undefined" & masterViewModel.geocodedAddress != "undefined") {
      if (typeof masterViewModel.geocodedAddress.peek() != "undefined" && masterViewModel.geocodedAddress.peek() !== null)
      {
        console.log("address is ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }
}, 200);
}

// wait for urls to have loaded
function whenUrlIsReady(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
    if (typeof urls !== "undefined" & typeof urls.Base !== "undefined") {
      if (urls.Base !== null)
      {
        console.log("urls is ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }
}, 200);
}

// wait for job to have loaded
function whenJobIsReady(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
      if (masterViewModel.jobLoaded() == true)
      {
        console.log("job is ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
}, 200);
}

//checkbox for hide completed tasking

function renderSectorFilterCheckBox() {
  return (
    <span class="pull-right h6">
    <span id="lighthouseSectorFilterEnabled" class="fa fa-lg"></span>
    <img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
    src={lighthouseUrl+"icons/lh-black.png"} /> Instant Filter by Sector
    </span>
    );
}

function renderCheckBox() {
  return (
    <span class="pull-right h6">
    <span id="lighthouseEnabled" class="fa fa-lg"></span>
    <img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
    src={lighthouseUrl+"icons/lh-black.png"} /> Collapse Completed Tasking
    </span>
    );
}

function untaskTeamFromJob(TeamID, JobID, TaskingID) {
  $.ajax({
    type: 'DELETE'
    , url: urls.Base+'/Api/v1/Tasking/'+TaskingID
    , beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    }
    , data: {
      'Id':       TaskingID
      ,'TeamId':    TeamID
      , 'JobId':    JobID
      ,'LighthouseFunction': 'untaskTeamFromJob'
      ,'userId': user.Id
    }
    , cache: false
    , dataType: 'json'
    , complete: function(response, textStatus) {
      if (textStatus == 'success')
      {
        masterViewModel.teamsViewModel.loadTaskedTeams() //load teams
        masterViewModel.JobManager.GetHistory(jobId,function(t){masterViewModel.jobHistory(t)}) //load job history
        masterViewModel.JobManager.GetJobById(jobId,Enum.JobViewModelType.Full.Id,function(t){masterViewModel.jobStatus(t.JobStatusType)}) //update status
      }

    }
  })
}

function pad(n, z) {
  z = z || '0';
  n = n + '';
  return n.length >= 2 ? n : new Array(2 - n.length + 1).join(z) + n;
}

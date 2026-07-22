# OLD Clipisode Theme Documentation

## Invitation Themes

Clipisode invitation links give a tightly-controlled multi-screen flow with customizable designs for you to get videos from anyone using a mobile phone. These invitation links used a form-based file upload to trigger phone and tablet cameras, got the usage rights for these videos, and brought all of the replies into a CMS/portal where the host could do anything they wanted with the videos. The default mode was to combine the intro video and replies into a single show, an episode of clips or "clipisode." Because we combined these videos together, we did not directly support replies from desktops or horizontal videos. 

In the original pre-WordPress Clipisode platform, these invitation link screens were customizable via a combination of JSON configuration (which included both data values and markup blocks) and assets (like a CSS file, images and font files). Below are all the values you could set in the old JSON config.

The available screens were:

1. Intro Screen — This shows the intro video in a full screen player that covers the background. If there is no intro video, we showed a gradient from blue to black. On top of the background video layer was this topic's title, host name, a reply button which triggers video recording, an upload link if you have a pre-recorded reply video and some text with links to the legal Terms you are agreeing to when you reply.
    a. Intro Screen Desktop — if you opened an invitation link on desktop, we would show a wide desktop layout with the playable intro video on one side and an explanation on the other side with a QR code to click to open this same link on a phone
1. Name Screen — After making or choosing a reply video, we start uploading the video and ask you to provide some data, either a name or a name plus a social handle. Invitation links can determine if they are being loaded inside the X or Instagram apps, so they can ask for your social handle for those networks.
1. Email Screen — Optionally, before showing the success screen, we would show an Email capture screen in a modal on top of the success screen. This let us collect an email address, plus could show one or more checkboxes stating what we could do with that email address, for example we could show 2 checkboxes with the labels "I want to enter the Rolex sweepstakes" and "Please notify me when Marvel does another Clipisode." Those checkbox values determined what Lists these replies got added to, like mailing lists or lists that could go into a spreadsheet.
1. Success Screen — This is the final screen. The default design is a screen that says "Nice work! Your reply for HOST_NAME was sent." But a brand might show an ad for a show on Disney+ or a QR code coupon.
1. Warning Screens — Besides the desktop layout that we showed to non-phones, there were four warning states which could have a custom background shade/overlay.
    a. Camera — If we sent the user off to record a video and no video was returned, it could be because the link was opened in an app like Facebook where the user turned off camera access. So we would tell them what to try next, like opening the link in a browser.
    a. Network — If the video was recorded but was failing to upload (or slow to upload), we would tell them to check their network connection and try again.
    a. Silent — We used client-side JS to check the video file for audio. Sometimes an app like Facebook will have Camera permission without Microphone. So a reply video would record without audio. We would alert the user and give them the option to try again, upload a pre-recorded video or open the link in their browser.
    a. Wide — If the video was horizontal, like from an upload, we would warn that hosts prefer vertical video and give the option to either send the video anyway or re-record.

### Warning: Camera

* siteData.warningCamera.description  
* siteData.warningCamera.dismissButtonLabel

### Warning: Network

* siteData.warningNetwork.title  
* siteData.warningNetwork.description  
* siteData.warningNetwork.redoButtonLabel

### Warning: Silent

* siteData.warningSilent.title  
* siteData.warningSilent.description  
* siteData.warningSilent.redoButtonLabel  
* siteData.warningSilent.continueLinkLabel

### Warning: Wide

* siteData.warningSilent.title  
* siteData.warningSilent.description  
* siteData.warningSilent.redoButtonLabel  
* siteData.warningSilent.continueLinkLabel


Here are the old JSON configuration details:

### Intro Screen

* \#introScreen — mobile layout  
* \#videoArea — video area background for text-only invitations  
  * .playButtonContainer  
    * siteData.introScreen.instructions  
* \#introTop — top block with fade  
  * \#introHostName — Host name, H2  
  * \#introTitle — Ask title, H1  
* \#introBottom — bottom block with fade, optional IG extra padding  
  * \#recordingControls  
    * \#recordButton (same ID for Chrome ready button)  
    * \#uploadLink (the colored styled words are inside a span tag, not anchor)  
  * \#introTerms — terms container

### Intro Screen Desktop

* \#introScreenDesktop — desktop layout  
  * \#detailsContainer — box of non-video content  
    * siteData.introScreenDesktop.markup  
* \#videoArea — video area background for text-only invitations  
* \#noVideoArea — shown when there’s no intro video

### Name Screen

* \#nameScreen (container)  
* siteData.nameScreen.nameScreenHeader — header markup (ours has icon)  
* nameScreenHeading — H1 with form title and upload progress  
* Form  
  * form.fieldContainer  
    * form.labelContainer  
      * label.formLabel — second one is optional validation  
      * label.formLabelInvalid  
    * input.formInput — for name and social  
    * input.formInputInvalid  
  * \#buttonsContainer  
    * \#button  
* P — tags for explainer lines below the form  
  * siteData.nameScreen.instructions  
  * siteData.nameScreen.socialDescription  
  * siteData.nameScreen.pleaseWait

### Email Screen

* \#emailScreenOverlay (behind the modal)  
* \#emailScreen (container)  
* Form  
  * emailScreenHeading — H1 with form title  
  * input.formInput — for name and social  
  * input.formInputInvalid  
  * .optionContainer  
    * .optionLabel  
    * .optionInput  
    * .optionCheckmark  
    * .optionDescription  
  * \#buttonsContainer  
    * \#button  
* P — tags for explainer lines below the form  
  * siteData.nameScreen.instructions  
  * siteData.nameScreen.socialDescription  
  * siteData.nameScreen.pleaseWait

### Success Screen

* siteData.successScreen.markup

### Warnings

* \#modalShade (background overlay)  
* \#modalContainer (contains warning message markup)

### Warning: Camera

* siteData.warningCamera.description  
* siteData.warningCamera.dismissButtonLabel

### Warning: Network

* siteData.warningNetwork.title  
* siteData.warningNetwork.description  
* siteData.warningNetwork.redoButtonLabel

### Warning: Silent

* siteData.warningSilent.title  
* siteData.warningSilent.description  
* siteData.warningSilent.redoButtonLabel  
* siteData.warningSilent.continueLinkLabel

### Warning: Wide

* siteData.warningSilent.title  
* siteData.warningSilent.description  
* siteData.warningSilent.redoButtonLabel  
* siteData.warningSilent.continueLinkLabel



# Clipisode Invitation Link Customization

Clipisode invitation links have a very tightly controlled mobile flow, but are customizable. As we recreate the Clipisode platform in a WordPress plugin, we are using the WordPress Gutenberg block editor to allow that customization. Here is an outline of all of the screens, the blocks and layouts that make them up, what can be changed and what functionality lives outside of the customization.

The problem with what we’ve been building so far is that sometimes we make blocks that don’t work in WordPress. They’re too complex and end up breaking the UI and causing it to show a “recover this block” button. We seem to have the general flow down, using the IAPI (Interactivity API) to control swapping out screen contents while the reply video continues to upload. But we need a tight plan for making these screens safely editable and brandable.

Overall, these screens need to perfectly fill a mobile browser screen, with no gaps or rubber band movement. The exception is the desktop layout, which needs to show the intro video and explain what the visitor needs to do, which is scan the QR code to open this link on their phone. These screens should work reliably all the way back to Android 12 and other phones and inside apps like Facebook, X and Instagram.

## Intro Screen

Our current layout works well. There is a background video that can be played or paused. If there is no intro video, we show a gradient. When the video plays, we fade out the other screen elements across 300ms. There are two layers here: background and foreground. In the block editor, the background gradient block should be editable. The video play button SVG should be editable/replaceable. The video itself is locked and doesn’t even need to be previewed in the block editor.

In the foreground, we have a good handle on the layout right now. We need a flex grid that positions some elements at the top and some at the bottom, leaving the middle space free to see the video. The top elements are the host name and topic title, but you can add a . We show placeholders in the block editor that get replaced by the real values. We need to add a way to preview that with real data, like a data simulator. In the bottom, we have the reply button, upload link, and terms and conditions text and link. The text in those needs to be editable, but the links need to remain. The button label and style (color, shape, width) are editable. We also need a sidebar tool for giving the alternate button strings like “Saving…” so they can localize all the button states.

And we put a gradient behind the top and bottom sections, so the words would be readable on top of different videos. We actually both had a drop shadow under the words and we had a gradient of like 20% black from the top that went to 0% at around a third of the way down the screen and then a mirror of the same gradient at the bottom. Can you check the old code and see if that was a single stretched PNG or a CSS gradient and copy that? It would be part of the background, but ideally something the user could edit.

## Name Screen

In the sample I uploaded, we have an icon, a progress heading that shows “Uploading 35%” where the 35 gets replaced with the percentage complete value of the upload. We also fixed the layout so as it goes from 0% to 100% the centered text position doesn’t jump around. And when the upload is complete, I think it changes to say “Upload complete” which should be an alternate label that gets set in the sidebar. The things we want people to be able to change are: label text, font, color, position, size, adding extra images.

How do we position a Name input control in WordPress blocks? What values can be edited? We should make an input group for each that has the left-aligned label, optional word “optional” on the right, and the label as a model for how it can be positioned.

How should we control whether the optional social handle input appears? For reference, we would show this if we detect the reply is being collected inside an app which uses social handles like Instagram or X. Do we make it so if the handle is there, we capture it? Then the default theme can have both Name and Handle showing, and if they don’t want to collect the social handle, they can just delete that input. How’s that?

## Email Screen

Similar to the social handle, I think we collect email as a modal over the Success screen — unless the Email screen is deleted from the theme. Then we don’t show it, because we can’t. Is that a good way to control whether these extra values are collected?

The Email capture also has zero or more checkboxes for opting into Lists. Assuming we set those up as List records and they have a description, how do we show them in this Email screen? Each one you activate would show a vertically-centered checkbox on the left next to its label on the right, which could wrap. How do you choose many? How do we preview them? Should the description label be something you can override here?

There should be a link at the bottom that closes the modal and leaves the user on the Success screen, which was underneath all along. “Skip this” is the default text for this link.

All text should be able to be edited, colored, underlined or not, resized.

## Success Screen

This is in the screenshots. It shows a text message at the top, with a placeholder for the HOST\_NAME. Then an icon/logo for Clipisode that the host can change to McDonalds or Starbucks or Mr Beast or whatever. Or the whole success screen can be a full-screen PNG. This canvas is wide open.
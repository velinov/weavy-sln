﻿/*global Turbolinks, twttr */
var wvy = wvy || {};

wvy.fileupload = (function ($) {

    // event handler for removing existing file from input field
    $(document).on("click", ".file-upload .clear", function (evt) {
        evt.preventDefault();
        
        var $upload = $(this).closest('.file-upload');
        $upload.find("input[type=hidden]").val("delete");

        var $custom = $upload.find(".custom-file-control");
        $custom.text("");

        var $img = $upload.find("img");
        $img.prop("src", $img.data("thumb"));
        $(this).addClass("d-none");

        var $svg = $upload.find("svg");        
        $svg.addClass("d-none");
    });

    // replace existing files after uploading files to folder
    $(document).on("submit", ".upload-replace", function (e) {
        e.preventDefault();
        var $alert = $(this).closest(".alert");
        var action = $(this).attr("action");
        var ids = $(this).find("input[name=blobs]").val().split(',').map(function (val) { return Number(val); });
        $.ajax({
            url: action,
            type: "PUT",
            contentType: "application/json",
            data: JSON.stringify({ blobs: ids })
        }).done(function (data, status, xhr) {
            // reload page
            Turbolinks.visit(location.toString(), { action: "replace" })
        }).fail(function (xhr, status, error) {
            var json = JSON.parse(xhr.responseText);
            wvy.alert.warning(json.message);
        }).always(function () {
            $alert.alert('close');
        });
    });

    // skip existing files after upload to folder
    $(document).on("click", ".upload-skip", function (e) {
        $(this).closest(".alert").alert('close');
        if ($(this).data("uploaded") > 0) {
            // reload page to display uploaded files
            Turbolinks.visit(location.toString(), { action: "replace" })
        }
    });

    // init file uploads
    document.addEventListener("turbolinks:load", function () {
        // file upload
        $(".file-upload input[type=file]").fileupload({
            dataType: "json",
            pasteZone: null,
            add: function (e, data) {
                $(this).removeClass("is-invalid");
                var $upload = $(this).closest(".file-upload");
                var $custom = $upload.find(".custom-file-control").text("");
                var $text = $upload.find(".form-text").removeClass("d-none");
                var $feedback = $upload.find(".invalid-feedback").removeClass("d-block");
                var errors = validate(data.files, $(this).data("max-size"), $(this).attr("accept"));
                if (errors.length > 0) {
                    $(this).addClass("is-invalid");
                    $text.addClass("d-none");
                    $feedback.addClass("d-block").text(errors.join(" "));
                } else {
                    // show progressbar
                    $custom.text("Uploading...");
                    $upload.find(".progress").removeClass("invisible");
                    // upload file
                    data.submit();
                }
            },
            progressall: function (e, data) {
                // update progress bar
                $(this).closest(".file-upload").find(".progress-bar").css("width", parseInt(data.loaded / data.total * 100, 10) + "%");
            },
            done: function (e, data) {
                var json = data.result.data[0];

                var $upload = $(this).closest(".file-upload");
                $upload.find("input[type=hidden]").val(json.id);
                $upload.find(".clear").removeClass("d-none");
                $upload.find(".custom-file-control").text(json.name);
                if (json.thumb_url) {
                    $upload.find("img").removeClass("d-none").prop("src", json.thumb_url.replace("{options}", "256"));                    
                }
                
                $(this).focus();
            },
            fail: function (e, data) {
                console.error(data.jqXHR.responseJSON.message);
            },
            always: function () {
                // reset progress bar
                var $upload = $(this).closest(".file-upload");
                $upload.find(".progress").addClass("invisible").find(".progress-bar").css("width", "0%");
            }
        });
        
        $(".fab-upload input[type=file]").fileupload({
            dataType: "json",
            pasteZone: null,
            add: function (e, data) {                
                $("head").after("<div class='turbolinks-progress-bar custom'></div>");

                if (e.delegatedEvent.type !== "drop") {
                    // close dropup
                    $("main > .fab [data-toggle='dropdown']").dropdown("toggle");
                }

                // upload file
                data.submit();
            },
            progressall: function (e, data) {
                // update progress bar            
                $("html > .turbolinks-progress-bar.custom").css({ "width": parseInt(data.loaded / data.total * 100, 10) + "%", "opacity": 1 });
            },
            done: function (e, data) {
                if (data.result.skipped) {
                    var action = wvy.url.resolve($(this).data("url"));
                    var ids = $.map(data.result.skipped, function (val) { return val.id; }).join(",");
                    var uploaded = data.result.uploaded ? data.result.uploaded.length : 0;
                    if (data.result.skipped.length === 1) {
                        wvy.alert.warning('There is already a file named ' + data.result.skipped[0].name + '.' +
                            '<form action="' + action + '" class="alert-form upload-replace">' +
                            '<input type="hidden" name="blobs" value="' + ids + '" />' +
                            '<button type="submit" class="btn btn-icon">' +
                            '<svg class="i i-check" height="24" viewBox="0 0 24 24" width="24"><path d="m21 7-12 12-5.5-5.5 1.41-1.41 4.09 4.08 10.59-10.58z"/></svg> Replace the file' +
                            '</button > ' +
                            '</form>' +
                            '<button type="button" class="btn btn-icon upload-skip" data-uploaded="' + uploaded + '">' +
                            '<svg class="i i-close" height="24" viewBox="0 0 24 24" width="24"><path d="m19 6.41-1.41-1.41-5.59 5.59-5.59-5.59-1.41 1.41 5.59 5.59-5.59 5.59 1.41 1.41 5.59-5.59 5.59 5.59 1.41-1.41-5.59-5.59z"/></svg> Skip this file' +
                            '</button>');
                    } else {
                        wvy.alert.warning('There are ' + data.result.skipped.length + ' files with the same names.' +
                            '<form action="' + action +'" class="alert-form upload-replace">' +
                            '<input type="hidden" name="blobs" value="' + ids + '" />' +
                            '<button type="submit" class="btn btn-icon">' +
                            '<svg class="i i-check" height="24" viewBox="0 0 24 24" width="24"><path d="m21 7-12 12-5.5-5.5 1.41-1.41 4.09 4.08 10.59-10.58z"/></svg> Replace the files' +
                            '</button>' +
                            '</form>' +
                            '<button type="button" class="btn btn-icon upload-skip" data-uploaded="' + uploaded + '">' +
                            '<svg class="i i-close" height="24" viewBox="0 0 24 24" width="24"><path d="m19 6.41-1.41-1.41-5.59 5.59-5.59-5.59-1.41 1.41 5.59 5.59-5.59 5.59 1.41 1.41 5.59-5.59 5.59 5.59 1.41-1.41-5.59-5.59z"/></svg> Skip these files' +
                            '</button>');
                    }
                } else {
                    // reload page
                    Turbolinks.visit(location.toString(), { action: "replace" })
                }
            },
            fail: function (e, data) {
                console.error(data.jqXHR.responseJSON.message);
            },
            always: function () {
                // remove progress bar
                $("html > .turbolinks-progress-bar.custom").remove();
            }
        });

        $(".content-upload input[type=file]").fileupload({
            dataType: "json",
            pasteZone: null,
            dropZone: $(".content-dropzone"),
            add: function (e, data) {
                $("head").after("<div class='turbolinks-progress-bar custom'></div>");

                // upload file
                data.submit();
            },
            progressall: function (e, data) {
                
                $("html > .turbolinks-progress-bar.custom").css({ "width": parseInt(data.loaded / data.total * 100, 10) + "%", "opacity": 1 });
            },
            done: function (e, data) {
                if (data.result.skipped) {
                    var action = wvy.url.resolve($(this).data("url"));
                    var ids = $.map(data.result.skipped, function (val) { return val.id; }).join(",");
                    var uploaded = data.result.uploaded ? data.result.uploaded.length : 0;
                    if (data.result.skipped.length === 1) {
                        wvy.alert.warning('There is already a file named ' + data.result.skipped[0].name + '.' +
                            '<form action="' + action + '" class="alert-form upload-replace">' +
                            '<input type="hidden" name="blobs" value="' + ids + '" />' +
                            '<button type="submit" class="btn btn-icon">' +
                            '<svg class="i i-check" height="24" viewBox="0 0 24 24" width="24"><path d="m21 7-12 12-5.5-5.5 1.41-1.41 4.09 4.08 10.59-10.58z"/></svg> Replace the file' +
                            '</button > ' +
                            '</form>' +
                            '<button type="button" class="btn btn-icon upload-skip" data-uploaded="' + uploaded + '">' +
                            '<svg class="i i-close" height="24" viewBox="0 0 24 24" width="24"><path d="m19 6.41-1.41-1.41-5.59 5.59-5.59-5.59-1.41 1.41 5.59 5.59-5.59 5.59 1.41 1.41 5.59-5.59 5.59 5.59 1.41-1.41-5.59-5.59z"/></svg> Skip this file' +
                            '</button>');
                    } else {
                        wvy.alert.warning('There are ' + data.result.skipped.length + ' files with the same names.' +
                            '<form action="' + action + '" class="alert-form upload-replace">' +
                            '<input type="hidden" name="blobs" value="' + ids + '" />' +
                            '<button type="submit" class="btn btn-icon">' +
                            '<svg class="i i-check" height="24" viewBox="0 0 24 24" width="24"><path d="m21 7-12 12-5.5-5.5 1.41-1.41 4.09 4.08 10.59-10.58z"/></svg> Replace the files' +
                            '</button>' +
                            '</form>' +
                            '<button type="button" class="btn btn-icon upload-skip" data-uploaded="' + uploaded + '">' +
                            '<svg class="i i-close" height="24" viewBox="0 0 24 24" width="24"><path d="m19 6.41-1.41-1.41-5.59 5.59-5.59-5.59-1.41 1.41 5.59 5.59-5.59 5.59 1.41 1.41 5.59-5.59 5.59 5.59 1.41-1.41-5.59-5.59z"/></svg> Skip these files' +
                            '</button>');
                    }
                } else {
                    // reload page
                    Turbolinks.visit(location.toString(), { action: "replace" })
                }
            },
            fail: function (e, data) {
                console.error(data.jqXHR.responseJSON.message);
            },
            always: function () {                
                $("html > .turbolinks-progress-bar.custom").remove();
            }
        });
    });

    // destroy file uploads
    document.addEventListener("turbolinks:before-cache", function () {
        //console.debug("fileupload.js:destroy");

        $(".file-upload input[type=file]").each(function (i) {
            if ($(this).fileupload("instance") !== undefined) {
                $(this).fileupload("destroy");
            }
        });

        $(".fab-upload input[type=file]").each(function (i) {
            if ($(this).fileupload("instance") !== undefined) {
                $(this).fileupload("destroy");
            }
        });

        $(".content-upload input[type=file]").each(function (i) {
            if ($(this).fileupload("instance") !== undefined) {
                $(this).fileupload("destroy");
            }
        });

    });

    // validate filetype and sizes
    function validate(files, maxSize, accept) {
        var errors = [];

        $.each(files, function (index, file) {

            // accepted file types for this field
            if (errors.length === 0 && accept && accept.length && file["name"].length) {
                accept = accept.split(", ").join("|");
                var rx = new RegExp("(" + accept + ")$", "i");
                //console.debug("Validating " + file["name"] + " against " + rx.source);
                if (!rx.test(file["name"])) {
                    errors.push("File type is not allowed.");
                }
            }

            // maximum file size for this this field
            var fs = parseInt(file["size"]);
            if (errors.length === 0 && maxSize) {
                if (fs > parseInt(maxSize)) {
                    errors.push("The file is too big.");
                }
            }

            // maximum file size (global)
            if (errors.length === 0 && wvy.config.maxUploadSize) {
                if (fs > parseInt(wvy.config.maxUploadSize)) {
                    errors.push("The file is too big.");
                }
            }
        });
        return errors;
    }

    return {
        validate: validate
    };

})(jQuery);

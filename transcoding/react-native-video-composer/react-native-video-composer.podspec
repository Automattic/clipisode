# coding: utf-8
# Copyright (c) Facebook, Inc. and its affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
version = package['version']

source = { :git => 'https://github.com/clipisode/react-native-video-composer.git' }
if version.end_with? == '-pre'
  # This is an unpublished version, use the latest commit hash of the react-native repo, which we’re presumably in.
  source[:commit] = `git rev-parse HEAD`.strip
else
  # source[:tag] = "v#{version}"
  source[:branch] = "master"
end

Pod::Spec.new do |s|
  s.name                   = "ReactNativeVideoComposer"
  s.version                = version
  s.summary                = package["description"]
  s.homepage               = "https://clipisode.github.io/react-native-video-composer"
  s.documentation_url      = "https://clipisode.github.io/react-native-video-composer/docs"
  s.license                = package["license"]
  s.author                 = "Max Schmeling"
  s.platforms              = { :ios => "10.0" }
  s.source                 = source
  s.source_files           = "ios/**/*.{h,m,swift}"

  s.dependency "React"
end

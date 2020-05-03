# frozen_string_literal: true
require 'test_helper'
require 'project_types/extension/extension_test_helpers'

module Extension
  class ExtensionProjectTest < MiniTest::Test
    include TestHelpers::FakeUI
    include ExtensionTestHelpers::TempProjectSetup

    def setup
      super
      setup_temp_project
    end

    def test_write_project_files_creates_env_and_shopify_cli_files
      @new_context = TestHelpers::FakeContext.new(root: Dir.mktmpdir)
      FileUtils.cd(@new_context.root)
      ExtensionProject.write_project_files(
        context: @new_context,
        api_key: 'test_key',
        api_secret: 'test_secret',
        title: 'Registration Title',
        type: @type.identifier
      )

      assert File.exists?('.env')
      assert File.exists?('.shopify-cli.yml')
      assert_equal :extension, ShopifyCli::Project.current_project_type
    end

    def test_can_access_app_specific_values_as_an_app
      assert_kind_of Models::App, @project.app
      assert_equal @api_key, @project.app.api_key
      assert_equal @api_secret, @project.app.secret
    end

    def test_title_returns_the_title
      assert_equal @title, @project.title
    end

    def test_title_returns_nil_if_title_is_missing
      setup_temp_project(title: nil)
      assert_nil ExtensionProject.current.title
    end

    def test_extension_type_returns_the_set_type_as_a_type_instance
      assert_kind_of Models::Type, @project.extension_type
      assert_equal @type.identifier, @project.extension_type.identifier
    end

    def test_can_write_and_read_registration_id_values
      refute @project.registration_id?
      @project.set_registration_id(@context, 42)

      assert_equal 42, @project.registration_id
    end

    def test_detects_if_registration_id_is_missing_or_invalid
      @project.set_registration_id(@context, "")
      refute @project.registration_id?

      @project.set_registration_id(@context, 0)
      refute @project.registration_id?
    end

    def test_overrides_an_existing_registration_id
      @project.set_registration_id(@context, 42)
      @project.set_registration_id(@context, 52)

      assert_equal 52, @project.registration_id
    end

    def test_only_writes_env_file_if_registration_id_is_different
      ShopifyCli::Resources::EnvFile.any_instance.expects(:write).once

      @project.set_registration_id(@context, 42)
      @project.set_registration_id(@context, 42)
    end

    def test_set_registration_id_does_not_write_the_env_file_if_registration_id_empty
      ShopifyCli::Resources::EnvFile.any_instance.expects(:write).never

      @project.set_registration_id(@context, nil)
    end

    def test_delegate_standard_project_methods_to_internal_project_instance
      @project.project.expects(:env).once
      @project.env

      @project.project.expects(:directory).once
      @project.directory

      @project.project.expects(:config).once
      @project.config
    end
  end
end

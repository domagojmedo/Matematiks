using Blazored.LocalStorage;
using Matematiks.Domain.Entities;

namespace Matematiks.Domain;

public interface ISettingsService
{
    Settings GetSettings();
    void SetSelectedNumbers(List<int> selectedNumbers);
}

public class SettingsService(ISyncLocalStorageService storage) : ISettingsService
{
    public Settings GetSettings()
    {
        return storage.GetItem<Settings>("settings") ?? new();
    }

    public void SetSelectedNumbers(List<int> selectedNumbers)
    {
        var settings = GetSettings();

        settings.SelectedNumbers = selectedNumbers;

        storage.SetItem("settings", settings);
    }
}

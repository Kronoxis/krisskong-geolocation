# Geolocation

## Configuration 
### Glitch
1. Configure `PROJECT` in `.env` to match the name of your Glitch project.

### StreamElements
1. Open [Overlays](https://streamelements.com/dashboard/overlays)
2. Edit your Overlay
3. Add a Widget: `STATIC / CUSTOM` > `Custom widget`
4. Select the Widget, open the `Settings` and select `OPEN EDITOR`
5. Replace all code in the `HTML` tab with the following code:
```HTML
<iframe src="https://PROJECT.glitch.me/APPLICATION" style="
    width: 100%; height: 100%; 
    margin: 0; padding: 0;
    appearance: none; outline: none; border: none;
"></iframe>
```
6. In `src` above, replace `PROJECT` with the name of your Glitch project. 
7. In `src` above, replace `APPLICATION` with the name of the application you want to load. Valid applications are:
    - `speedometer`
    - `minimap`
8. Clear all code in the `CSS`, `JS`, `FIELDS` and `DATA` tabs.

## Usage
Open the glitch.me website. 
It should automatically start showing your realtime location data and speed.

You can disable application to hide them in the overlay and save on data processing.

⚠ Keep the website open.
Location data will stop updating if the device sleeps or the tab becomes inactive.

## Troubleshooting
If an overlay stops updating or shows an invalid value (e.g. `N/A`), try refreshing the overlay to restart the connection.
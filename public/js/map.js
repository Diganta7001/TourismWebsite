
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
const map = new mapboxgl.Map({
    accessToken: MAPBOX_ACCESS_TOKEN,
    container: 'map', // container ID
    center: coordinates, // starting position [lng, lat]. Note that lat must be set between -90 and 90
    zoom: 9 // starting zoom
});

console.log(coordinates)
 const marker1 = new mapboxgl.Marker({color:'red'})
        .setLngLat(coordinates)
        .setPopup(
            new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
                <h3>${listingLocation}</h3>
                <p>Exact location will be shared after booking</p>
            `)
).addTo(map);


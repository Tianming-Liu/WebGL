// Function to fetch earthquake data
async function fetchEarthquakeData() {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const formatDate = (date) => date.toISOString().split('T')[0];

    const urltemp = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${formatDate(today)}&endtime=${formatDate(tomorrow)}&minmagnitude=1`;

    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2023-12-06&endtime=2023-12-07&minmagnitude=1`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.features; // Return the array of earthquake features
    } catch (error) {
        console.error('Error fetching earthquake data:', error);
        return [];
    }
}


// Function to add earthquake markers to the map
function addEarthquakeMarkersToMap(map, earthquakes) {
    earthquakes.forEach(quake => {
        const { coordinates } = quake.geometry;
        const { mag, place } = quake.properties;

        const el = document.createElement('div');
        el.className = 'custom-marker';

        new mapboxgl.Marker(el)
            .setLngLat([coordinates[0], coordinates[1]]) // Longitude, Latitude
            .setPopup(new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<strong>Magnitude:</strong> ${mag}<br/><strong>Location:</strong> ${place || 'Unknown'}`))
            .addTo(map);
    });
}


// Function to get the realtime location of the user
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject('Geolocation is not supported by your browser');
        } else {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        }
    });
}

function calculateArcPoints(start, end, numPoints = 100) {
    let points = [];
    for (let i = 0; i <= numPoints; i++) {
        const fraction = i / numPoints;
        const lat = start.lat + fraction * (end.lat - start.lat);
        const lng = start.lng + fraction * (end.lng - start.lng);
        const alt = Math.sin(fraction * Math.PI) * 4; // Adjust altitude for dome effect
        points.push([lng, lat, alt]);
    }
    return points;
}

function createCircularScatterChart(data) {
    const width = 900, height = 900, radius = 305;
    const svg = d3.select("#scatter-container").append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    
    const axisLineLength = 0; // length for time line
    const numRadials = 12; // Num of the time line
    for (let i = 0; i < numRadials; i++) {
        const angle = (i / numRadials) * 2 * Math.PI;
        // Calculate the time line startPt and endPt
        const lineStartX = (radius - 4) * Math.cos(angle);
        const lineStartY = (radius - 4) * Math.sin(angle);
        const lineEndX = (radius - axisLineLength) * Math.cos(angle);
        const lineEndY = (radius - axisLineLength) * Math.sin(angle); 

        g.append("line")
        .attr("x1", lineStartX)
        .attr("y1", lineStartY)
        .attr("x2", lineEndX)
        .attr("y2", lineEndY)
        .style("stroke", "white")
        .style("stroke-width", 1);

        // Add time anotation
        if (i % 1 === 0) { // Every two hours
            // Set a offset distance for time anotation
            const offset = 20;
            const textX = lineEndX - offset * Math.cos(angle);
            const textY = lineEndY - offset * Math.sin(angle);

            // Calculate the angle to rotate the text for making it parallel with the circle
            const textRotation = angle * (180 / Math.PI) - 90;

            // Create the text element for time anotation
            const textGroup = g.append("g")
                .attr("transform", `translate(${textX},${textY}) rotate(${textRotation})`);

            // Add time series anotation
            textGroup.append("text")
                .attr("dy", ".35em")
                .style("text-anchor", "middle")
                .style("font-size", "10px")
                .style("fill", "white")
                .text(`${i * 2}:00`);
        }
    }
    const extendLineLength =25;
    const textOffset = 10;
    

    // Create a scale to map the magnitude
    const radiusScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.magnitude || 0)])
        .range([1, 9]); // Set the radius range for the point to change


    data.forEach(d => {
        // Use UTC time to get the hour and minute
        const hours = d.time.getUTCHours();
        const minutes = d.time.getUTCMinutes();
        const totalMinutes = hours * 60 + minutes;

        // Convert the time among the day into the degree of the circle scatter chart
        const angle = (totalMinutes / (24 * 60)) * 2 * Math.PI;

        // Calculate the location of the scatter point
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);

         // Calculate the circle radius via scale
        const pointRadius = radiusScale(d.magnitude || 0); // If there is no mag data, display 0
        
        // Add line for the anotation
        const lineEndX = (radius + extendLineLength) * Math.cos(angle);
        const lineEndY = (radius + extendLineLength) * Math.sin(angle);

        g.append("line")
            .attr("x1", x)
            .attr("y1", y)
            .attr("x2", lineEndX)
            .attr("y2", lineEndY)
            .style("stroke", "grey")
            .style("stroke-width", 0.5)
            .style("stroke-dasharray", "2,2");

        // Add scatter points in the chart
        g.append('circle')
        .attr('class', 'scatter-point')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', pointRadius) // Dot radius
        .style('fill', 'white') // Dot color
        .on("mouseover", (event, d) => {
            console.log("Mouse over event triggered");
            console.log("Event:", event);
            console.log("Data:", d);
            d3.select(event.target)
                .transition()
                .duration(200)
                .attr("r", 25)
                .style("fill", "red");
        })
        .on("mouseout", (event, d) => {
            console.log("Mouse out event triggered");
            console.log("Event:", event);
            console.log("Data:", d);
            d3.select(event.target)
                .transition()
                .duration(200)
                .attr("r", 5)
                .style("fill", "white");
        });
        
        
        // Add earthquake detail
        if (d.title) {
            // split the text to display the location only
            const titleParts = d.title.split('of');

            // get the location info behind the "of"
            const displayedLocation = titleParts[1] ? titleParts[1].trim() : "No location details";

            const displayColor = titleParts[1] ? "white" : "red";

            const displaySize = titleParts[1] ? "9px" : "7px";

            const textAngle = angle * (180 / Math.PI); // Convert the degree

            g.append("text")
                .attr("x", lineEndX)
                .attr("y", lineEndY)
                .style("text-anchor", "left")
                .style("font-size", displaySize)
                .style("fill", displayColor)
                .attr("transform", `rotate(${textAngle},${lineEndX},${lineEndY})`)
                .text(displayedLocation);
        };
    });
}

function preprocessData(features) {
    return features.map(feature => {
        return {
            time: new Date(feature.properties.time), // Convert timestamp to Date object
            magnitude: feature.properties.mag,
            title: feature.properties.title
        };
    });
}



// Find the closest earthquake point to the user location
function findClosestEarthquake(userLocation, earthquakes) {
    let closestEarthquake = earthquakes[0];
    let closestDistance = Infinity;

    earthquakes.forEach(earthquake => {
        const distance = turf.distance(userLocation, earthquake.geometry, { units: 'miles' });
        if (distance < closestDistance) {
            closestDistance = distance;
            closestEarthquake = earthquake;
        }
    });

    return closestEarthquake;
}
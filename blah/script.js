// Function to fetch and process Condition.json
async function fetchConditions() {
  try {
    const response = await fetch("../data/mimic-fhir/Condition.json");
    const data = await response.json();

    // Count occurrences of each condition
    const diagnosisCounts = {};
    const conditionDetails = {};

    data.forEach((entry) => {
      if (entry.code && entry.code.coding) {
        entry.code.coding.forEach((coding) => {
          let conditionName = coding.display;
          diagnosisCounts[conditionName] =
            (diagnosisCounts[conditionName] || 0) + 1;

          // Store associated patient & encounter references
          conditionDetails[conditionName] = {
            subject: entry.subject.reference,
            encounter: entry.encounter.reference,
          };
        });
      }
    });

    // Convert to array and get top 10 conditions
    let conditions = Object.entries(diagnosisCounts)
      .map(([name, count]) => ({
        name,
        count,
        details: conditionDetails[name],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    createChart(conditions);
  } catch (error) {
    console.error("Error fetching Condition.json:", error);
  }
}

// Function to create the main D3 chart with tooltip
function createChart(conditions) {
  const width = 800,
    height = 400;
  const margin = { top: 40, right: 30, bottom: 50, left: 80 };

  d3.select("#chart").html("");
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const xScale = d3
    .scaleBand()
    .domain(conditions.map((d) => d.name))
    .range([margin.left, width - margin.right])
    .padding(0.3);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(conditions, (d) => d.count)])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // Create tooltip div (hidden by default)
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("background", "#fff")
    .style("padding", "8px")
    .style("border-radius", "4px")
    .style("box-shadow", "0px 0px 4px rgba(0, 0, 0, 0.2)");

  // Draw bars & add interactivity
  svg
    .selectAll(".bar")
    .data(conditions)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", (d) => xScale(d.name))
    .attr("y", (d) => yScale(d.count))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - margin.bottom - yScale(d.count))
    .attr("fill", (d, i) => colorScale(i))
    .on("mouseover", function (event, d) {
      tooltip.transition().duration(200).style("opacity", 1);

      // Display tooltip with condition details
      tooltip
        .html(
          `
        <strong>${d.name}</strong><br>
        🏥 Patients: ${d.count}<br>
        🏥 Click for More Details
      `
        )
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 20 + "px");

      d3.select(this).style("opacity", 0.7);
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 20 + "px");
    })
    .on("mouseout", function () {
      tooltip.transition().duration(200).style("opacity", 0);
      d3.select(this).style("opacity", 1);
    })
    .on("click", (event, d) => {
      window.location.href = `../Conditions/index.html?condition=${encodeURIComponent(
        d.name
      )}`;
    });

  // Add Y-axis
  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale).ticks(6));

  // Legend
  const legend = d3.select("#legend").html("");
  conditions.forEach((condition, i) => {
    legend
      .append("div")
      .attr("class", "legend-item")
      .html(
        `<div class="legend-color" style="background:${colorScale(i)}"></div> ${
          condition.name
        }`
      );
  });
}

// Fetch data on page load
fetchConditions();

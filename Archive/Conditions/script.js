// Extract condition from URL
const urlParams = new URLSearchParams(window.location.search);
const selectedCondition = urlParams.get("condition");
console.log("Selected Condition:", selectedCondition);

// Paths for the JSON data
const conditionPath = "../data/mimic-fhir/Condition.json";
const patientPath = "../data/mimic-fhir/Patient.json";
const encounterPath = "../data/mimic-fhir/Encounter.json";

// Function to fetch and process condition details
async function fetchDetails() {
  try {
    console.log("Fetching data...");
    const [conditionResponse, patientResponse, encounterResponse] =
      await Promise.all([
        fetch(conditionPath),
        fetch(patientPath),
        fetch(encounterPath),
      ]);

    if (!conditionResponse.ok || !patientResponse.ok || !encounterResponse.ok) {
      throw new Error("Error fetching JSON files");
    }

    const [conditions, patients, encounters] = await Promise.all([
      conditionResponse.json(),
      patientResponse.json(),
      encounterResponse.json(),
    ]);

    console.log("Condition Data:", conditions);
    console.log("Patient Data:", patients);
    console.log("Encounter Data:", encounters);

    // Find matching conditions
    const matchedConditions = conditions.filter((c) =>
      c.code?.coding?.some((coding) => coding.display === selectedCondition)
    );

    if (matchedConditions.length === 0) {
      document.getElementById("chart").innerHTML = "<p>No data found.</p>";
      return;
    }

    // Extract Patient & Encounter IDs
    const patientIds = [
      ...new Set(
        matchedConditions.map((c) => c.subject.reference.split("/")[1])
      ),
    ];
    const encounterIds = [
      ...new Set(
        matchedConditions.map((c) => c.encounter.reference.split("/")[1])
      ),
    ];

    console.log("Patient IDs:", patientIds);
    console.log("Encounter IDs:", encounterIds);

    // Find matching Patients & Encounters
    const matchedPatients = patients.filter((p) => patientIds.includes(p.id));
    const matchedEncounters = encounters.filter((e) =>
      encounterIds.includes(e.id)
    );

    console.log("Matched Patients:", matchedPatients);
    console.log("Matched Encounters:", matchedEncounters);

    // Count gender distribution per admission class
    const genderAdmissionCounts = {};

    matchedEncounters.forEach((encounter) => {
      const patient = matchedPatients.find(
        (p) => p.id === encounter.subject?.reference?.split("/")[1]
      );
      if (!patient) return;

      const gender = patient.gender || "Unknown";
      const admissionClass = encounter.class?.code || "Unknown";

      if (!genderAdmissionCounts[gender]) {
        genderAdmissionCounts[gender] = {};
      }
      if (!genderAdmissionCounts[gender][admissionClass]) {
        genderAdmissionCounts[gender][admissionClass] = 0;
      }
      genderAdmissionCounts[gender][admissionClass]++;
    });

    console.log("Gender + Admission Distribution:", genderAdmissionCounts);

    // Render the grouped bar chart
    renderGenderAdmissionChart(genderAdmissionCounts);

    // Render the table below the graph
    renderTable(genderAdmissionCounts);
  } catch (error) {
    console.error("Error fetching details:", error);
    document.getElementById("chart").innerHTML = `<p>Error loading data.</p>`;
  }
}

// Function to create a grouped bar chart (Gender + Admission Class)
function renderGenderAdmissionChart(genderAdmissionCounts) {
  const width = 600,
    height = 400;
  const margin = { top: 40, right: 30, bottom: 70, left: 80 };

  // Remove existing chart before rendering a new one
  d3.select("#chart").html("");

  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Transform data for D3
  const genders = Object.keys(genderAdmissionCounts);
  const admissionClasses = new Set();

  let data = [];
  genders.forEach((gender) => {
    Object.entries(genderAdmissionCounts[gender]).forEach(
      ([admission, count]) => {
        data.push({ gender, admission, count });
        admissionClasses.add(admission);
      }
    );
  });

  const x0Scale = d3
    .scaleBand()
    .domain(genders)
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const x1Scale = d3
    .scaleBand()
    .domain([...admissionClasses])
    .range([0, x0Scale.bandwidth()])
    .padding(0.1);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.count)])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const colorScale = d3
    .scaleOrdinal(d3.schemeCategory10)
    .domain([...admissionClasses]);

  // Draw bars
  svg
    .append("g")
    .selectAll("g")
    .data(genders)
    .enter()
    .append("g")
    .attr("transform", (d) => `translate(${x0Scale(d)},0)`)
    .selectAll("rect")
    .data((gender) => data.filter((d) => d.gender === gender))
    .enter()
    .append("rect")
    .attr("x", (d) => x1Scale(d.admission))
    .attr("y", (d) => yScale(d.count))
    .attr("width", x1Scale.bandwidth())
    .attr("height", (d) => height - margin.bottom - yScale(d.count))
    .attr("fill", (d) => colorScale(d.admission));

  // Add X-axis
  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x0Scale));

  // Add Y-axis
  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale));

  // Labels
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height - 20)
    .attr("text-anchor", "middle")
    .text("Gender");

  svg
    .append("text")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Number of Patients");

  // Title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text(`Gender & Admission Class for ${selectedCondition}`);
}

// Function to render a table below the graph
function renderTable(genderAdmissionCounts) {
  const tableDiv = d3.select("#table").html(""); // Clear previous table

  // Create table structure
  const table = tableDiv.append("table").attr("class", "data-table");
  const header = table.append("thead").append("tr");

  header.append("th").text("Gender");
  header.append("th").text("Admission Class");
  header.append("th").text("Number of Patients");

  const tbody = table.append("tbody");

  Object.entries(genderAdmissionCounts).forEach(([gender, admissions]) => {
    Object.entries(admissions).forEach(([admission, count]) => {
      const row = tbody.append("tr");
      row.append("td").text(gender);
      row.append("td").text(admission);
      row.append("td").text(count);
    });
  });
}

// Fetch details and render the chart on page load
fetchDetails();

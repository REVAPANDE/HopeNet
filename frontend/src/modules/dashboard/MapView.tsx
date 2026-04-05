import { Fragment } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Minus, Plus } from "lucide-react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { AllocationResponse, Task, Volunteer } from "../../types";

const volunteerIcon = new L.DivIcon({
  className: "map-pin volunteer-pin",
  html: "<span></span>",
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const volunteerOfflineIcon = new L.DivIcon({
  className: "map-pin volunteer-pin offline",
  html: "<span></span>",
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const taskIcon = new L.DivIcon({
  className: "map-pin task-pin",
  html: "<span></span>",
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

function MapNavigationControls() {
  const map = useMap();
  const offset = 180;

  return (
    <div className="map-navigation">
      <button className="map-nav-button center" onClick={() => map.panBy([0, -offset])} aria-label="Pan up">
        <ChevronUp size={14} />
      </button>
      <div className="map-navigation-row">
        <button className="map-nav-button" onClick={() => map.panBy([-offset, 0])} aria-label="Pan left">
          <ChevronLeft size={14} />
        </button>
        <button className="map-nav-button focus" onClick={() => map.setView([12.9716, 77.5946], 11)} aria-label="Reset">
          .
        </button>
        <button className="map-nav-button" onClick={() => map.panBy([offset, 0])} aria-label="Pan right">
          <ChevronRight size={14} />
        </button>
      </div>
      <button className="map-nav-button center" onClick={() => map.panBy([0, offset])} aria-label="Pan down">
        <ChevronDown size={14} />
      </button>
      <div className="map-zoom-stack">
        <button className="map-nav-button" onClick={() => map.zoomIn()} aria-label="Zoom in">
          <Plus size={14} />
        </button>
        <button className="map-nav-button" onClick={() => map.zoomOut()} aria-label="Zoom out">
          <Minus size={14} />
        </button>
      </div>
    </div>
  );
}

function zoneTone(task: Task) {
  if (task.priority_score >= 85) return { color: "#DC2626", fillOpacity: 0.16, label: "Critical" };
  if (task.priority_score >= 65) return { color: "#F97316", fillOpacity: 0.12, label: "High" };
  return { color: "#EAB308", fillOpacity: 0.1, label: "Moderate" };
}

function demandIntensity(task: Task) {
  const priorityWeight = Math.min(1, task.priority_score / 100);
  const impactWeight = Math.min(1, task.people_affected / 220);
  return Math.min(1, priorityWeight * 0.65 + impactWeight * 0.35);
}

export function MapView(props: {
  tasks: Task[];
  volunteers: Volunteer[];
  allocation: AllocationResponse;
  highlightedArea: string | null;
  isSimulated: boolean;
}) {
  const taskMap = new Map(props.tasks.map((task) => [task.id, task]));
  const volunteerMap = new Map(props.volunteers.map((volunteer) => [volunteer.id, volunteer]));
  const reasonMap = new Map(
    props.allocation.reasons.map((reason) => [`${reason.volunteer_id}:${reason.task_id}`, reason])
  );

  return (
    <section className="map-surface">
      <MapContainer center={[12.9716, 77.5946]} zoom={11} scrollWheelZoom zoomControl={false} className="map-canvas clean-map">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <MapNavigationControls />

        {props.volunteers.map((volunteer) => (
          <Marker
            key={volunteer.id}
            position={[volunteer.location.lat, volunteer.location.lng]}
            icon={volunteer.status === "offline" ? volunteerOfflineIcon : volunteerIcon}
          >
            <Popup>
              <strong>{volunteer.name}</strong>
              <br />
              {`Status: ${volunteer.status}`}
              <br />
              {`Capacity: ${Math.max(0, volunteer.capacity - volunteer.assigned_count)} remaining`}
            </Popup>
            <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
              {`${volunteer.name} | ${volunteer.status}`}
            </Tooltip>
          </Marker>
        ))}

        {props.tasks.map((task) => {
          const tone = zoneTone(task);
          const intensity = demandIntensity(task);
          const isHighlighted = props.highlightedArea?.toLowerCase() === task.area.toLowerCase();
          return (
            <Fragment key={task.id}>
              <Circle
                center={[task.location.lat, task.location.lng]}
                radius={Math.max(420, task.people_affected * 18)}
                pathOptions={{
                  stroke: false,
                  fillColor: tone.color,
                  fillOpacity: isHighlighted ? 0.1 + intensity * 0.16 : 0.05 + intensity * 0.12,
                  className: "demand-heat-layer"
                }}
              />
              <Circle
                center={[task.location.lat, task.location.lng]}
                radius={Math.max(280, task.people_affected * 10)}
                pathOptions={{
                  color: tone.color,
                  fillColor: tone.color,
                  fillOpacity: isHighlighted ? tone.fillOpacity + 0.08 : tone.fillOpacity,
                  weight: isHighlighted ? 2 : 1
                }}
              >
                <Tooltip direction="top" opacity={0.95}>
                  {`${task.title} | ${task.area} | ${tone.label} | Demand ${(intensity * 100).toFixed(0)}%`}
                </Tooltip>
              </Circle>
              <Marker position={[task.location.lat, task.location.lng]} icon={taskIcon}>
                <Popup>
                  <strong>{task.title}</strong>
                  <br />
                  {task.area}
                  <br />
                  {`${task.people_affected} people affected`}
                </Popup>
                <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                  {`${task.area} | Priority ${Math.round(task.priority_score)}`}
                </Tooltip>
              </Marker>
            </Fragment>
          );
        })}

        {props.allocation.assignments.map((assignment) => {
          const task = taskMap.get(assignment.task_id);
          const volunteer = volunteerMap.get(assignment.volunteer_id);
          const reason = reasonMap.get(`${assignment.volunteer_id}:${assignment.task_id}`);
          if (!task || !volunteer) return null;
          return (
            <Polyline
              key={`${assignment.volunteer_id}-${assignment.task_id}`}
              positions={[
                [volunteer.location.lat, volunteer.location.lng],
                [task.location.lat, task.location.lng]
              ]}
              pathOptions={{
                color: "#0F766E",
                weight: 2,
                opacity: 0.75,
                dashArray: props.isSimulated ? "8 8" : "10 7",
                className: props.isSimulated ? "assignment-route simulated-route" : "assignment-route live-route"
              }}
            >
              <Tooltip sticky opacity={0.95}>
                {`${volunteer.name} -> ${task.title} | Score ${(reason?.final_score ?? assignment.score).toFixed(2)} | ${(reason?.distance_km ?? 0).toFixed(1)} km | Confidence ${Math.round((reason?.confidence ?? 0) * 100)}%`}
              </Tooltip>
            </Polyline>
          );
        })}
      </MapContainer>

      <div className="map-overlay top-left minimal">
        <strong>{props.isSimulated ? "Simulated Deployment" : "Live Field View"}</strong>
      </div>
      <div className="map-overlay legend">
        <strong>Legend</strong>
        <span><i className="legend-swatch critical" /> Critical demand</span>
        <span><i className="legend-swatch high" /> High demand</span>
        <span><i className="legend-swatch moderate" /> Moderate demand</span>
        <span><i className="legend-swatch heat" /> Demand heat</span>
        <span><i className="legend-swatch route" /> Assignment route</span>
      </div>
    </section>
  );
}

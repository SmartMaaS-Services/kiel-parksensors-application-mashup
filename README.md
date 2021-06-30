<h2 align="center">
  <a href="https://smart-maas.eu/en/"><img src="https://github.com/SmartMaaS-Services/Transaction-Context-Manager/blob/main/docs/images/Header.jpeg" alt="Smart MaaS" width="500"></a>
  <br>
      SMART MOBILITY SERVICE PLATFORM
  <br>
  <a href="https://smart-maas.eu/en/"><img src="https://github.com/SmartMaaS-Services/Transaction-Context-Manager/blob/main/docs/images/Logos-Smart-MaaS.png" alt="Smart MaaS" width="250"></a>
  <br>
</h2>

<p align="center">
  <a href="mailto:info@smart-maas.eu">Contact</a> •
  <a href="https://github.com/SmartMaaS-Services/Transaction-Context-Manager/issues">Issues</a> •
  <a href="https://smart-maas.eu/en/">Project Page</a>
</p>


***

<h1 align="center">
  <a>
    kiel-parksensors-application-mashup
  </a>
</h1>

***

This project is an extension of the project "kiel-parksensors" and an introduction to [FIWARE Wirecloud](https://Wirecloud.rtfd.io). 
It will be shown how the status of the parking spaces can be visualized on a map using Wirecloud mashups and widgets.

The overall aim of Wirecloud is to allow someone without a programming background to be able to create data
visualizations using a drag-and-drop interface. A wide range of existing open-source
[Wirecloud Widgets and Operators](https://wirecloud.readthedocs.io/en/stable/widgets/) are already available and can be
used to create complex visualizations.

The Node.js script periodically queries states of parking spots on 'Kiellinie' in Kiel and imports transformed data both into FIWARE Orion v2 and FIWARE Orion LD context broker.

The Node.js script and the context brokers run in docker containers which in turn are composed within the included docker-compose.yml.

To pull/create the images and start the containers simply run `./services create && ./services start` from the project root folder.
To stop the containers run `./services stop`

If you encounter problems executing the script, add the missing permission with `chmod +x services`.

You can GET a list of all ParkingSpot entities via  
`<docker_host>:1026/v2/entities?type=ParkingSpot&attrs=id&options=keyValues` (for Orion v2)  
`<docker_host>:1027/ngsi-ld/v1/entities?type=ParkingSpot&attrs=id,name&options=keyValues` (for Orion LD)  

Run `./services start` and wait wait for it to initialize completely, and visit `http://localhost:8000`.

The next step is to create a user to log in to Wirecloud:

    - $ docker exec -ti some-wirecloud manage.py createsuperuser
    - Username (leave blank to use 'root'): admin
    - Email address: ${youremail}
    - Password: ${yourpassword}
    - Password (again): ${yourpassword}
    - Superuser created successfully.`

Now you can follow the documentation of https://github.com/FIWARE/tutorials.Application-Mashup#adding-resources-to-wirecloud
1) Login with your user.
2) Create new workspace.
3) Creating Application Mashups.

Settings NSGI Browser Widget

    -   NGSI server URl: http://orion-v2:1026/
    -   NGSI entity types: ParkingSpot
    
Settings NGSI Source Operator
 
    - NGSI server URL: http://orion-v2:1026/
    - NGSI proxy URL: https://ngsi-proxy:8100
    - NGSI entity types: ParkingSpot
    
Settings NGSI Entity to POI Operator
    
    - Coordinates attribute: location
    
Settings Open Layers Map Widget

    - Initial Location: 10.15,54.34
    - Initial Zoom Level: 16
    - Min Zoom: 4
    - PoI Zoom: 15
 
 
The updated mashup can be seen on the workspace tab (refresh the browser if necessary).

#include <simplex3DNoise>

uniform float uFrequency;
uniform float uStrength;
uniform float uEdge;
uniform float uProcess;
uniform vec3 uEdgeColor;

varying vec3 vPosition;

void main()
{   
    float noise = snoise(vPosition * uFrequency) * uStrength;

    if(noise < uProcess)  discard;
    
    float edgeWidth = uProcess + uEdge;

    if(noise > uProcess && noise < edgeWidth)
    {
        csm_Emissive = uEdgeColor;
        csm_Metalness = 0.0;
        csm_Roughness = 1.0;
    }
}